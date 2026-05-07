// ============================================================
// VitalSync - Cloud Functions
// Punto de entrada principal
// ============================================================

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { v4: uuidv4 } = require("uuid");
const logger = require("firebase-functions/logger");

// Inicializar Firebase Admin (esto se hace UNA sola vez)
initializeApp();
const db = getFirestore();

// ============================================================
// Endpoint: registrarSignosVitales
// Recibe datos del paramédico, separa PII, evita duplicados
// ============================================================
exports.registrarSignosVitales = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    
    // Solo aceptamos peticiones POST
    if (req.method !== "POST") {
      return res.status(405).json({
        exito: false,
        error: "Método no permitido. Usa POST."
      });
    }

    try {
      const datos = req.body;
      
      // VALIDACIÓN BÁSICA
      if (!datos.requestId || !datos.paciente || !datos.signosVitales) {
        return res.status(400).json({
          exito: false,
          error: "Faltan campos obligatorios: requestId, paciente, signosVitales"
        });
      }

      // PASO 1: Verificar idempotencia (driver E11/E12)
      // Verificar dulicados
      const existente = await db.collection("pacientes")
        .where("requestId", "==", datos.requestId)
        .limit(1)
        .get();

      if (!existente.empty) {
        const docExistente = existente.docs[0];
        logger.info(`Idempotencia: requestId ${datos.requestId} ya procesado`);
        return res.status(200).json({
          exito: true,
          idAnonimo: docExistente.id,
          mensaje: "Paciente ya registrado previamente (idempotencia)",
          duplicado: true
        });
      }

      // PASO 2: Generar ID único
      const idAnonimo = uuidv4();

      // PASO 3: Guardar PII en colección separada (driver E05)
      await db.collection("pacientes_pii").doc(idAnonimo).set({
        idAnonimo: idAnonimo,
        nombreCompleto: datos.paciente.nombreCompleto,
        documentoIdentidad: datos.paciente.documentoIdentidad,
        tipoDocumento: datos.paciente.tipoDocumento || "CC",
        creadoPor: datos.paramedicoId,
        timestampCreacion: FieldValue.serverTimestamp()
      });

      // PASO 4: Guardar datos médicos (sin PII)
      await db.collection("pacientes").doc(idAnonimo).set({
        idAnonimo: idAnonimo,
        triage: datos.signosVitales.triage,
        frecuenciaCardiaca: datos.signosVitales.frecuenciaCardiaca,
        presionSistolica: datos.signosVitales.presionSistolica,
        presionDiastolica: datos.signosVitales.presionDiastolica,
        ambulanciaId: datos.ambulanciaId,
        paramedicoId: datos.paramedicoId,
        estado: "EN_RUTA",
        requestId: datos.requestId,
        timestampCreacion: FieldValue.serverTimestamp(),
        timestampActualizacion: FieldValue.serverTimestamp()
      });

      // PASO 5: Si es triage ROJO, crear alerta SMS
      if (datos.signosVitales.triage === "ROJO") {
        await db.collection("alertas_sms").add({
          pacienteId: idAnonimo,
          cirujanoTelefono: "+573001234567", // Por ahora hardcoded, después lo configuramos
          mensaje: `ALERTA: Paciente Triage ROJO en camino. Ambulancia ${datos.ambulanciaId}.`,
          enviado: false,
          timestampCreacion: FieldValue.serverTimestamp()
        });
        logger.info(`Alerta ROJO creada para paciente ${idAnonimo}`);
      }

      // En logs NUNCA incluimos el nombre real (driver E05)
      logger.info(`Paciente ${idAnonimo} registrado. Triage: ${datos.signosVitales.triage}`);

      return res.status(201).json({
        exito: true,
        idAnonimo: idAnonimo,
        mensaje: "Paciente registrado exitosamente"
      });

    } catch (error) {
      // En logs NUNCA incluimos el body completo (podría tener PII)
      logger.error("Error en registrarSignosVitales:", error.message);
      return res.status(500).json({
        exito: false,
        error: "Error interno del servidor"
      });
    }
  }
);
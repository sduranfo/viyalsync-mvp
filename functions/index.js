// ============================================================
// VitalSync - Cloud Functions
// Punto de entrada principal
// ============================================================

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { v4: uuidv4 } = require("uuid");
const logger = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const twilio = require("twilio");

// Definir los secrets para producción
const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = defineSecret("TWILIO_PHONE_NUMBER");
const cirujanoPhoneNumber = defineSecret("CIRUJANO_PHONE_NUMBER");

// Inicializar Firebase Admin (esto se hace UNA sola vez)
initializeApp();
const db = getFirestore();

// ============================================================
// HELPERS: Reintentos con backoff exponencial
// ============================================================

const dormir = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Hace un fetch con reintentos automáticos y backoff exponencial.
 * Distingue entre errores 4xx (no reintentar) y 5xx (reintentar).
 * 
 * @param {string} url - URL del servicio a llamar
 * @param {object} opciones - Opciones del fetch (method, headers, body)
 * @param {number} maxIntentos - Número máximo de intentos (default: 3)
 * @returns {Promise<object>} { exito, intento, respuesta?, error?, permanente? }
 */
const fetchConReintentos = async (url, opciones, maxIntentos = 3) => {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const respuesta = await fetch(url, opciones);
      
      // Éxito (2xx)
      if (respuesta.ok) {
        return { exito: true, intento, respuesta };
      }
      
      // Error 4xx: petición mal formada, NO tiene sentido reintentar
      if (respuesta.status >= 400 && respuesta.status < 500) {
        return { 
          exito: false, 
          intento, 
          error: `HTTP ${respuesta.status}`,
          permanente: true 
        };
      }
      
      // Error 5xx: servidor con problemas, vale la pena reintentar
      throw new Error(`HTTP ${respuesta.status}`);
      
    } catch (error) {
      logger.warn(`Intento ${intento}/${maxIntentos} falló: ${error.message}`);
      
      // Si fue el último intento, devolver el error
      if (intento === maxIntentos) {
        return { 
          exito: false, 
          intento, 
          error: error.message,
          permanente: false 
        };
      }
      
      // Backoff exponencial: 2s, 4s, 8s, 16s...
      const esperaMs = Math.pow(2, intento) * 1000;
      logger.info(`Esperando ${esperaMs / 1000}s antes del siguiente intento...`);
      await dormir(esperaMs);
    }
  }
};

// ============================================================
// Endpoint: registrarSignosVitales
// Recibe datos del paramédico, separa PII, evita duplicados
// ============================================================
exports.registrarSignosVitales = onRequest(
  { 
    cors: true, 
    region: "us-central1",
    secrets: [cirujanoPhoneNumber]
  },
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
      
      // ========== VALIDACIONES MÉDICAS ==========

      // Validar estructura del payload
      if (!datos || typeof datos !== 'object') {
        return res.status(400).json({ 
          exito: false, 
          error: 'Payload inválido o vacío' 
        });
      }

      if (!datos.paciente || !datos.signosVitales) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Faltan campos obligatorios: paciente o signosVitales' 
        });
      }

      // Validar requestId (UUID)
      if (!datos.requestId || datos.requestId.length < 10) {
        return res.status(400).json({ 
          exito: false, 
          error: 'requestId inválido o ausente' 
        });
      }

      // Validar Triage
      const triagesValidos = ['ROJO', 'AMARILLO', 'VERDE'];
      if (!triagesValidos.includes(datos.signosVitales.triage)) {
        return res.status(400).json({ 
          exito: false, 
          error: `Triage inválido. Debe ser uno de: ${triagesValidos.join(', ')}` 
        });
      }

      // Validar Frecuencia Cardíaca (rango fisiológico: 20-250 bpm)
      const fc = parseInt(datos.signosVitales.frecuenciaCardiaca);
      if (isNaN(fc) || fc < 20 || fc > 250) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Frecuencia cardíaca fuera de rango (20-250 bpm)' 
        });
      }

      // Validar Presión Sistólica (rango: 40-300 mmHg)
      const sistolica = parseInt(datos.signosVitales.presionSistolica);
      if (isNaN(sistolica) || sistolica < 40 || sistolica > 300) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Presión sistólica fuera de rango (40-300 mmHg)' 
        });
      }

      // Validar Presión Diastólica (rango: 20-200 mmHg)
      const diastolica = parseInt(datos.signosVitales.presionDiastolica);
      if (isNaN(diastolica) || diastolica < 20 || diastolica > 200) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Presión diastólica fuera de rango (20-200 mmHg)' 
        });
      }

      // Validación lógica: sistólica DEBE ser mayor que diastólica
      if (sistolica <= diastolica) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Presión sistólica debe ser mayor que diastólica' 
        });
      }

      // Validar IDs
      if (!datos.ambulanciaId || !datos.paramedicoId) {
        return res.status(400).json({ 
          exito: false, 
          error: 'ambulanciaId y paramedicoId son obligatorios' 
        });
      }

      // Validar datos del paciente
      if (!datos.paciente.nombreCompleto || datos.paciente.nombreCompleto.trim().length < 2) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Nombre del paciente inválido' 
        });
      }

      if (!datos.paciente.documentoIdentidad || datos.paciente.documentoIdentidad.trim().length < 5) {
        return res.status(400).json({ 
          exito: false, 
          error: 'Documento de identidad inválido' 
        });
      }

      // ========== FIN DE VALIDACIONES ==========

      // PASO 1: Verificar idempotencia (driver E11/E12)
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
        frecuenciaCardiaca: fc,                    // ← usar el parseInt
        presionSistolica: sistolica,               // ← usar el parseInt
        presionDiastolica: diastolica,             // ← usar el parseInt
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
          cirujanoTelefono: process.env.CIRUJANO_PHONE_NUMBER,
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
      logger.error("Error en registrarSignosVitales:", error.message);
      return res.status(500).json({
        exito: false,
        error: "Error interno del servidor"
      });
    }
  }
);

// ============================================================
// HIS Legacy Mock

// ============================================================
// HIS Legacy Mock
// Simula el servidor del hospital: frágil, lento, falla a veces
// ============================================================
exports.hisLegacyMock = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Solo POST" });
    }

    const datos = req.body;
    
    // Validación mínima del HIS legacy (es exigente)
    if (!datos.pacienteId || !datos.triage) {
      return res.status(400).json({ 
        error: "HIS rechaza: faltan campos pacienteId o triage" 
      });
    }

    // SIMULACIÓN DE FRAGILIDAD: 10% de las veces falla aleatoriamente
    const fallaSimulada = Math.random() < 0.1;
    if (fallaSimulada) {
      logger.warn(`HIS Mock: simulando fallo para paciente ${datos.pacienteId}`);
      return res.status(503).json({ 
        error: "HIS no disponible temporalmente" 
      });
    }

    // SIMULACIÓN DE LENTITUD: el HIS es lento, tarda 200-500ms
    const latencia = 200 + Math.random() * 300;
    await new Promise(resolve => setTimeout(resolve, latencia));

    // Si todo va bien, el HIS responde con un ID de registro hospitalario
    const idHospitalario = `HIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    logger.info(`HIS Mock: paciente ${datos.pacienteId} registrado como ${idHospitalario}`);
    
    return res.status(200).json({
      exito: true,
      idHospitalario: idHospitalario,
      mensaje: "Paciente registrado en HIS"
    });
  }
);

// ============================================================
// Endpoint: encolarParaHIS
// Productor: recibe resumen clínico y lo encola para envío
// ============================================================
exports.encolarParaHIS = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    
    if (req.method !== "POST") {
      return res.status(405).json({ exito: false, error: "Solo POST" });
    }

    try {
      const datos = req.body;

      if (!datos.idAnonimo) {
        return res.status(400).json({
          exito: false,
          error: "Falta idAnonimo del paciente"
        });
      }

      // Buscar el paciente en /pacientes
      const pacienteDoc = await db.collection("pacientes").doc(datos.idAnonimo).get();
      
      if (!pacienteDoc.exists) {
        return res.status(404).json({
          exito: false,
          error: "Paciente no encontrado"
        });
      }

      const paciente = pacienteDoc.data();

      // Construir el payload que se enviará al HIS
      const payload = {
        pacienteId: paciente.idAnonimo,
        triage: paciente.triage,
        frecuenciaCardiaca: paciente.frecuenciaCardiaca,
        presionSistolica: paciente.presionSistolica,
        presionDiastolica: paciente.presionDiastolica,
        ambulanciaId: paciente.ambulanciaId,
        paramedicoId: paciente.paramedicoId
      };

      // Encolar el documento (estado PENDIENTE)
      const docCola = await db.collection("cola_his").add({
        pacienteId: datos.idAnonimo,
        payload: payload,
        estado: "PENDIENTE",
        intentos: 0,
        timestampCreacion: FieldValue.serverTimestamp()
      });

      logger.info(`Encolado paciente ${datos.idAnonimo} en cola HIS (docId: ${docCola.id})`);

      return res.status(202).json({
        exito: true,
        mensaje: "Resumen clínico encolado para envío al HIS",
        colaId: docCola.id
      });

    } catch (error) {
      logger.error("Error en encolarParaHIS:", error.message);
      return res.status(500).json({ exito: false, error: "Error interno" });
    }
  }
);
// ============================================================
// Worker programado: workerEnviarHIS
// Consumidor: cada 1 segundo, saca máx 2 docs y los envía al HIS
// ============================================================

exports.workerEnviarHIS = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1"
  },
  async (event) => {
    logger.info("Worker HIS iniciado");

    const pendientes = await db
      .collection("cola_his")
      .where("estado", "==", "PENDIENTE")
      .orderBy("timestampCreacion", "asc")
      .limit(2)
      .get();

    if (pendientes.empty) {
      logger.info("Worker HIS: cola vacía, nada que procesar");
      return;
    }

    logger.info(`Worker HIS: procesando ${pendientes.size} documentos`);

    for (const doc of pendientes.docs) {
      const data = doc.data();

      // Intentar enviar con reintentos automáticos
      const resultado = await fetchConReintentos(
        "http://127.0.0.1:5001/vitalsync-mvp/us-central1/hisLegacyMock",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.payload)
        },
        3 // máximo 3 intentos
      );

      if (resultado.exito) {
        // Éxito: marcar como ENVIADO
        await doc.ref.update({
          estado: "ENVIADO",
          intentos: resultado.intento,
          timestampEnvio: FieldValue.serverTimestamp()
        });
        
        await db.collection("pacientes").doc(data.pacienteId).update({
          estado: "ENTREGADO_HIS"
        });

        logger.info(`Worker HIS: paciente ${data.pacienteId} enviado en intento ${resultado.intento}`);
      } else if (resultado.permanente) {
        // Error 4xx: no reintentar
        await doc.ref.update({
          estado: "FALLIDO_PERMANENTE",
          intentos: resultado.intento,
          ultimoError: resultado.error,
          timestampUltimoIntento: FieldValue.serverTimestamp()
        });
        logger.error(`Worker HIS: paciente ${data.pacienteId} rechazado permanentemente: ${resultado.error}`);
      } else {
        // Error 5xx: marcar para reintentar más tarde
        const totalIntentos = (data.intentos || 0) + resultado.intento;
        const estadoFinal = totalIntentos >= 10 ? "FALLIDO" : "PENDIENTE";
        
        await doc.ref.update({
          estado: estadoFinal,
          intentos: totalIntentos,
          ultimoError: resultado.error,
          timestampUltimoIntento: FieldValue.serverTimestamp()
        });
        logger.warn(`Worker HIS: paciente ${data.pacienteId} reintentará. Total intentos: ${totalIntentos}/10`);
      }

      // Respetar rate limit del HIS (2 req/seg max)
      await dormir(500);
    }

    logger.info("Worker HIS finalizado");
  }
);
// ============================================================
// Trigger: enviarAlertaSMS
// Se ejecuta automáticamente cuando aparece un nuevo documento
// en /alertas_sms. Envía SMS al cirujano via Twilio.
// ============================================================
exports.enviarAlertaSMS = onDocumentCreated(
  {
    document: "alertas_sms/{docId}",
    region: "us-central1",
    secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber]
  },
  async (event) => {
    const docId = event.params.docId;
    const alerta = event.data.data();

    logger.info(`Trigger SMS activado para alerta ${docId}`);

    // Si ya está marcada como enviada, no hacer nada (idempotencia)
    if (alerta.enviado === true) {
      logger.info(`Alerta ${docId} ya estaba marcada como enviada. Skip.`);
      return;
    }

    try {
      // Inicializar cliente Twilio
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      // Enviar el SMS
      const mensaje = await client.messages.create({
        body: alerta.mensaje,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: alerta.cirujanoTelefono
      });

      logger.info(`SMS enviado exitosamente. SID: ${mensaje.sid}`);

      // Marcar como enviado en Firestore
      await event.data.ref.update({
        enviado: true,
        timestampEnvio: FieldValue.serverTimestamp(),
        twilioSid: mensaje.sid
      });

    } catch (error) {
      logger.error(`Error enviando SMS para alerta ${docId}:`, error.message);
      
      // Marcar el error en el documento
      await event.data.ref.update({
        enviado: false,
        ultimoError: error.message,
        intentos: (alerta.intentos || 0) + 1
      });
    }
  }
);
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
          cirujanoTelefono: process.env.CIRUJANO_PHONE_NUMBER, // Lee del .env
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
    schedule: "every 1 minutes", // En producción será cada minuto, pero procesa varios por minuto
    region: "us-central1"
  },
  async (event) => {
    logger.info("Worker HIS iniciado");

    // Sacar hasta 2 documentos PENDIENTES
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

    // Procesar cada documento secuencialmente (NO en paralelo, respetamos el rate limit)
    for (const doc of pendientes.docs) {
      const data = doc.data();

      try {
        // Llamar al HIS legacy mock
        const respuesta = await fetch(
          // Reemplaza con la URL de tu emulador o producción
          "http://127.0.0.1:5001/vitalsync-mvp/us-central1/hisLegacyMock",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.payload)
          }
        );

        if (respuesta.ok) {
          // Éxito: marcar como ENVIADO
          await doc.ref.update({
            estado: "ENVIADO",
            timestampEnvio: FieldValue.serverTimestamp()
          });
          
          // Actualizar el paciente principal
          await db.collection("pacientes").doc(data.pacienteId).update({
            estado: "ENTREGADO_HIS"
          });

          logger.info(`Worker HIS: paciente ${data.pacienteId} enviado exitosamente`);
        } else {
          // Falló: incrementar intentos
          const nuevosIntentos = data.intentos + 1;
          const estadoFinal = nuevosIntentos >= 3 ? "FALLIDO" : "PENDIENTE";

          await doc.ref.update({
            estado: estadoFinal,
            intentos: nuevosIntentos,
            ultimoError: `HTTP ${respuesta.status}`
          });

          logger.warn(`Worker HIS: fallo en paciente ${data.pacienteId}. Intento ${nuevosIntentos}/3`);
        }

        // CRÍTICO: esperar 500ms entre peticiones (respeto al rate limit del HIS)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.error(`Worker HIS: error procesando ${data.pacienteId}:`, error.message);
        await doc.ref.update({
          estado: "PENDIENTE", // Reintentar después
          intentos: (data.intentos || 0) + 1,
          ultimoError: error.message
        });
      }
    }

    logger.info("Worker HIS finalizado");
  }
);
// ============================================================
// SOLO PARA PRUEBAS LOCALES — copia del worker en versión HTTP
// Permite disparar el worker manualmente con curl en el emulador
// NO desplegar a producción
// ============================================================
exports.workerEnviarHISManual = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    logger.info("Worker HIS Manual iniciado");

    // Sacar hasta 2 documentos PENDIENTES
    const pendientes = await db
      .collection("cola_his")
      .where("estado", "==", "PENDIENTE")
      .orderBy("timestampCreacion", "asc")
      .limit(2)
      .get();

    if (pendientes.empty) {
      logger.info("Worker HIS Manual: cola vacía");
      return res.status(200).json({ 
        exito: true, 
        mensaje: "Cola vacía, nada que procesar",
        procesados: 0
      });
    }

    logger.info(`Worker HIS Manual: procesando ${pendientes.size} documentos`);
    const resultados = [];

    // Procesar cada documento secuencialmente
    for (const doc of pendientes.docs) {
      const data = doc.data();

      try {
        const respuesta = await fetch(
          "http://127.0.0.1:5001/vitalsync-mvp/us-central1/hisLegacyMock",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.payload)
          }
        );

        if (respuesta.ok) {
          await doc.ref.update({
            estado: "ENVIADO",
            timestampEnvio: FieldValue.serverTimestamp()
          });
          
          await db.collection("pacientes").doc(data.pacienteId).update({
            estado: "ENTREGADO_HIS"
          });

          resultados.push({ 
            pacienteId: data.pacienteId, 
            estado: "ENVIADO" 
          });
          logger.info(`Worker HIS Manual: paciente ${data.pacienteId} enviado`);
          
        } else {
          const nuevosIntentos = data.intentos + 1;
          const estadoFinal = nuevosIntentos >= 3 ? "FALLIDO" : "PENDIENTE";

          await doc.ref.update({
            estado: estadoFinal,
            intentos: nuevosIntentos,
            ultimoError: `HTTP ${respuesta.status}`
          });

          resultados.push({ 
            pacienteId: data.pacienteId, 
            estado: estadoFinal,
            intento: nuevosIntentos 
          });
          logger.warn(`Worker HIS Manual: fallo en ${data.pacienteId}. Intento ${nuevosIntentos}/3`);
        }

        // CRÍTICO: 500ms entre peticiones (rate limit)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.error(`Worker HIS Manual: error en ${data.pacienteId}:`, error.message);
        await doc.ref.update({
          estado: "PENDIENTE",
          intentos: (data.intentos || 0) + 1,
          ultimoError: error.message
        });
        resultados.push({ 
          pacienteId: data.pacienteId, 
          estado: "ERROR",
          error: error.message 
        });
      }
    }

    return res.status(200).json({
      exito: true,
      procesados: resultados.length,
      resultados: resultados
    });
    
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
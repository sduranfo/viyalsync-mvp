import * as SQLite from 'expo-sqlite';

// Abrimos (o creamos si no existe) la base de datos local
const db = SQLite.openDatabaseSync('vitalsync.db');

// Inicializa la tabla la primera vez que arranca la app
export const inicializarDB = () => {
  // Tabla de pacientes (ya existía)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS pacientes_locales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requestId TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      intentos INTEGER NOT NULL DEFAULT 0,
      ultimoError TEXT,
      timestampCreacion INTEGER NOT NULL,
      timestampEnvio INTEGER
    );
  `);
  
  // Tabla de configuración del dispositivo
  db.execSync(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);
  
  console.log('✓ Base de datos local inicializada');
};

// ============================================================
// Gestión del ID de ambulancia
// ============================================================

/**
 * Obtiene el ID de ambulancia de este dispositivo.
 * Si es la primera vez, genera uno aleatorio y lo guarda.
 */
export const obtenerAmbulanciaId = () => {
  // Buscar si ya hay un ID guardado
  const existente = db.getFirstSync(
    `SELECT valor FROM configuracion WHERE clave = 'ambulanciaId'`
  );
  
  if (existente) {
    console.log(`📍 ID de ambulancia: ${existente.valor}`);
    return existente.valor;
  }
  
  // Primera vez: generar un ID aleatorio entre 100-999
  const numero = Math.floor(Math.random() * 900) + 100;
  const nuevoId = `AMB-${numero}`;
  
  db.runSync(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)`,
    ['ambulanciaId', nuevoId]
  );
  
  console.log(`🆕 ID de ambulancia asignado: ${nuevoId}`);
  return nuevoId;
};

/**
 * Genera también un ID único para el paramédico de esta ambulancia.
 * Cada dispositivo tiene su propio paramédico.
 */
export const obtenerParamedicoId = () => {
  const existente = db.getFirstSync(
    `SELECT valor FROM configuracion WHERE clave = 'paramedicoId'`
  );
  
  if (existente) {
    return existente.valor;
  }
  
  const numero = Math.floor(Math.random() * 900) + 100;
  const nuevoId = `PARA-${numero}`;
  
  db.runSync(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)`,
    ['paramedicoId', nuevoId]
  );
  
  console.log(`🆕 ID de paramédico asignado: ${nuevoId}`);
  return nuevoId;
};



// Guarda un paciente nuevo en la cola local
export const guardarPacienteLocal = (requestId, payload) => {
  const payloadJson = JSON.stringify(payload);
  const timestamp = Date.now();
  
  db.runSync(
    `INSERT INTO pacientes_locales (requestId, payload, timestampCreacion) 
     VALUES (?, ?, ?)`,
    [requestId, payloadJson, timestamp]
  );
  
  console.log(`✓ Paciente guardado local con requestId: ${requestId}`);
};

// Devuelve todos los pacientes PENDIENTES de sincronizar
export const obtenerPendientes = () => {
  const resultado = db.getAllSync(
    `SELECT * FROM pacientes_locales 
     WHERE estado = 'PENDIENTE' 
     ORDER BY timestampCreacion ASC`
  );
  
  // Parsear el payload JSON de cada fila
  return resultado.map(fila => ({
    ...fila,
    payload: JSON.parse(fila.payload)
  }));
};

// Marca un paciente como ENVIADO exitosamente
export const marcarComoEnviado = (requestId) => {
  const timestamp = Date.now();
  db.runSync(
    `UPDATE pacientes_locales 
     SET estado = 'ENVIADO', timestampEnvio = ? 
     WHERE requestId = ?`,
    [timestamp, requestId]
  );
  console.log(`✓ Paciente ${requestId} marcado como ENVIADO`);
};

// Incrementa el contador de intentos y guarda el último error
export const marcarIntentoFallido = (requestId, mensajeError) => {
  db.runSync(
    `UPDATE pacientes_locales 
     SET intentos = intentos + 1, ultimoError = ? 
     WHERE requestId = ?`,
    [mensajeError, requestId]
  );
};

// Cuenta cuántos pacientes están pendientes (para mostrar en la UI)
export const contarPendientes = () => {
  const resultado = db.getFirstSync(
    `SELECT COUNT(*) as total FROM pacientes_locales WHERE estado = 'PENDIENTE'`
  );
  return resultado.total;
};

// Opcional: limpiar la BD (útil para testing)
export const limpiarDB = () => {
  db.execSync(`DELETE FROM pacientes_locales`);
  console.log('✓ Base de datos local limpiada');
};
// Marca un paciente como FALLIDO_PERMANENTE (datos inválidos, no reintentar)
export const marcarComoFallidoPermanente = (requestId, mensajeError) => {
  const timestamp = Date.now();
  db.runSync(
    `UPDATE pacientes_locales 
     SET estado = 'FALLIDO_PERMANENTE', 
         ultimoError = ?,
         timestampEnvio = ?
     WHERE requestId = ?`,
    [mensajeError, timestamp, requestId]
  );
  console.log(`⛔ Paciente ${requestId} marcado como FALLIDO_PERMANENTE: ${mensajeError}`);
};
import { 
  obtenerPendientes, 
  marcarComoEnviado, 
  marcarIntentoFallido 
} from '../db/database';

// ⚠️ Actualiza esta IP si tu PC cambia de red
const BACKEND_URL = 'http://192.168.1.11:5001/vitalsync-mvp/us-central1/registrarSignosVitales';

let sincronizandoEnEsteMomento = false;

// Función principal: intenta enviar todos los pendientes
export const sincronizarPendientes = async () => {
  // Evitar que se ejecute en paralelo (race condition)
  if (sincronizandoEnEsteMomento) {
    console.log('⏸ Ya hay una sincronización en curso, saltando...');
    return { exito: 0, fallidos: 0 };
  }
  
  sincronizandoEnEsteMomento = true;
  
  try {
    const pendientes = obtenerPendientes();
    
    if (pendientes.length === 0) {
      console.log('✓ No hay pendientes para sincronizar');
      return { exito: 0, fallidos: 0 };
    }
    
    console.log(`🔄 Sincronizando ${pendientes.length} paciente(s)...`);
    
    let exitos = 0;
    let fallidos = 0;
    
    // Procesar uno por uno (secuencial, no paralelo)
    for (const pendiente of pendientes) {
      try {
        // Timeout manual compatible con React Native
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000);

const respuesta = await fetch(BACKEND_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    requestId: pendiente.requestId,
    ...pendiente.payload
  }),
  signal: controller.signal
});

clearTimeout(timeoutId); // Si llegó la respuesta a tiempo, cancelamos el abortador
        
        const data = await respuesta.json();
        
        if (data.exito) {
          marcarComoEnviado(pendiente.requestId);
          exitos++;
          console.log(`✓ Enviado: ${pendiente.requestId.substring(0, 8)}...`);
        } else {
          marcarIntentoFallido(pendiente.requestId, data.error || 'Error desconocido');
          fallidos++;
          console.log(`✗ Falló (servidor): ${pendiente.requestId.substring(0, 8)}...`);
        }
      } catch (error) {
        marcarIntentoFallido(pendiente.requestId, error.message);
        fallidos++;
        console.log(`✗ Falló (red): ${pendiente.requestId.substring(0, 8)}... → ${error.message}`);
      }
    }
    
    console.log(`✓ Sincronización completa: ${exitos} enviados, ${fallidos} fallidos`);
    return { exito: exitos, fallidos };
    
  } finally {
    sincronizandoEnEsteMomento = false;
  }
};
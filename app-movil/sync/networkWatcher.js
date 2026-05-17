import NetInfo from '@react-native-community/netinfo';
import { sincronizarPendientes } from './syncManager';

let estadoAnteriorOnline = false;
let unsubscribe = null;

// Inicia la escucha de cambios de red
export const iniciarMonitoreoRed = (callbackEstado) => {
  unsubscribe = NetInfo.addEventListener(state => {
    const ahoraOnline = state.isConnected && state.isInternetReachable;
    
    console.log(`📡 Estado de red: ${ahoraOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    // Notificar a la UI
    if (callbackEstado) {
      callbackEstado(ahoraOnline);
    }
    
    // ⚡ Si pasamos de OFFLINE a ONLINE, disparar sincronización
    if (!estadoAnteriorOnline && ahoraOnline) {
      console.log('🚀 Conexión recuperada, sincronizando pendientes...');
      sincronizarPendientes();
    }
    
    estadoAnteriorOnline = ahoraOnline;
  });
};

// Detiene la escucha (importante para limpiar)
export const detenerMonitoreoRed = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

// Sincronización periódica adicional (cada 30 segundos)
let intervalId = null;

export const iniciarSyncPeriodico = () => {
  intervalId = setInterval(() => {
    console.log('⏰ Sync periódico cada 30s...');
    sincronizarPendientes();
  }, 30000); // 30 segundos
};

export const detenerSyncPeriodico = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
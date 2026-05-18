import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Configuración de Firebase
// NOTA: para emulador local estos valores no se validan, son placeholders
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "vitalsync-mvp.firebaseapp.com",
  projectId: "vitalsync-mvp",
  storageBucket: "vitalsync-mvp.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Obtener referencia a Firestore
export const db = getFirestore(app);

// Conectar al emulador local de Firestore
// El emulador escucha en el puerto 8080 por defecto
const USAR_EMULADOR = true; // cambiar a false cuando hagamos deploy en el Día 13

if (USAR_EMULADOR) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✓ Conectado al emulador de Firestore en localhost:8080');
  } catch (error) {
    console.warn('⚠ No se pudo conectar al emulador:', error.message);
  }
}

export default app;
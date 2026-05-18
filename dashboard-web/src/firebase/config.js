import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcAmk8Ljg4C8YnlBIIl6Vo4boScPh9GDs",
  authDomain: "vitalsync-mvp.firebaseapp.com",
  projectId: "vitalsync-mvp",
  storageBucket: "vitalsync-mvp.firebasestorage.app",
  messagingSenderId: "618129362949",
  appId: "1:618129362949:web:51aa1cae05f1ebcfaccc6c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const USAR_EMULADOR = false;

if (USAR_EMULADOR) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✓ Conectado al emulador local');
  } catch (error) {
    console.warn('⚠ No se pudo conectar al emulador:', error.message);
  }
}

export default app;
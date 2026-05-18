import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase/config';
import { reproducirAlarmaTriageRojo } from './utils/alarma';
import './App.css';

function App() {
  const [pacientes, setPacientes] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  useEffect(() => {
    console.log('🔄 Conectando listener a Firestore...');
    
    // Crear la consulta: todos los pacientes ordenados por fecha descendente
    const q = query(
      collection(db, 'pacientes'),
      orderBy('timestampCreacion', 'desc')
    );

    
    // Se ejecuta CADA VEZ que cambia algo en la colección
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nuevosPacientes = [];
        
        snapshot.forEach((doc) => {
          nuevosPacientes.push({
            id: doc.id,
            ...doc.data()
          });
        });

        console.log(`✓ Recibidos ${nuevosPacientes.length} paciente(s) desde Firestore`);
        setPacientes(nuevosPacientes);
        setConectado(true);
        setUltimaActualizacion(new Date());

        // Detectar si llegó alguien con Triage ROJO (lo manejaremos en Tarea 6)
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const paciente = change.doc.data();
                if (paciente.triage === 'ROJO') {
              dispararAlertaSonora();
            }
          }
        });
      },
      (error) => {
        console.error('❌ Error en listener:', error);
        setConectado(false);
      }
    );

    // Cleanup: cuando el componente se desmonte, cerrar el listener
    return () => {
      console.log('🔌 Cerrando listener de Firestore');
      unsubscribe();
    };
  }, []);

  const dispararAlertaSonora = () => {
  console.log('🚨 ALERTA: Triage ROJO detectado');
  reproducirAlarmaTriageRojo();
};

  const formatearHora = (timestamp) => {
    if (!timestamp) return '—';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTriageColor = (triage) => {
    switch (triage) {
      case 'ROJO': return 'triage-rojo';
      case 'AMARILLO': return 'triage-amarillo';
      case 'VERDE': return 'triage-verde';
      default: return 'triage-gris';
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>🚑 VitalSync Dashboard</h1>
          <p className="subtitulo">Sala de Emergencias · Hospital San Vicente</p>
        </div>
        <div className="header-right">
          <div className={`estado ${conectado ? 'conectado' : 'desconectado'}`}>
            {conectado ? '🟢 Conectado' : '🔴 Desconectado'}
          </div>
          <div className="ultima-actualizacion">
            Última actualización: {ultimaActualizacion ? formatearHora(ultimaActualizacion) : '—'}
          </div>
        </div>
      </header>

      {/* Estadísticas rápidas */}
      <div className="stats">
        <div className="stat-card stat-rojo">
          <div className="stat-numero">
            {pacientes.filter(p => p.triage === 'ROJO').length}
          </div>
          <div className="stat-label">Triage Rojo</div>
        </div>
        <div className="stat-card stat-amarillo">
          <div className="stat-numero">
            {pacientes.filter(p => p.triage === 'AMARILLO').length}
          </div>
          <div className="stat-label">Triage Amarillo</div>
        </div>
        <div className="stat-card stat-verde">
          <div className="stat-numero">
            {pacientes.filter(p => p.triage === 'VERDE').length}
          </div>
          <div className="stat-label">Triage Verde</div>
        </div>
        <div className="stat-card stat-total">
          <div className="stat-numero">{pacientes.length}</div>
          <div className="stat-label">Total Pacientes</div>
        </div>
      </div>

      {/* Lista de pacientes */}
      <main className="contenido">
        <h2>Pacientes Entrantes</h2>
        
        {pacientes.length === 0 ? (
          <div className="vacio">
            <p>⏳ Esperando pacientes...</p>
            <p className="vacio-subtitulo">
              Cuando una ambulancia envíe datos, aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="grid-pacientes">
            {pacientes.map((paciente) => (
              <div 
                key={paciente.id} 
                className={`tarjeta ${getTriageColor(paciente.triage)}`}
              >
                <div className="tarjeta-header">
                  <span className="triage-badge">
                    {paciente.triage || 'SIN TRIAGE'}
                  </span>
                  <span className="hora-llegada">
                    {formatearHora(paciente.timestampCreacion)}
                  </span>
                </div>

                <div className="tarjeta-body">
                  <div className="paciente-id">
                    ID: {paciente.idAnonimo?.substring(0, 8) || paciente.id.substring(0, 8)}...
                  </div>

                  <div className="signos-vitales">
                    <div className="signo">
                      <span className="signo-label">❤️ FC</span>
                      <span className="signo-valor">
                        {paciente.frecuenciaCardiaca || '—'} bpm
                      </span>
                    </div>
                    <div className="signo">
                      <span className="signo-label">🩸 PA</span>
                      <span className="signo-valor">
                        {paciente.presionSistolica || '—'}/
                        {paciente.presionDiastolica || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="ambulancia-info">
                    🚑 {paciente.ambulanciaId || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
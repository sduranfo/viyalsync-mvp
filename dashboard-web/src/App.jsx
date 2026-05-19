import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase/config';
import { reproducirAlarmaTriageRojo } from './utils/alarma';
import ModalPaciente from './components/ModalPaciente';
import './App.css';

function App() {
  const [pacientes, setPacientes] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);

  useEffect(() => {
    console.log('🔄 Conectando listener a Firestore...');
    
    const q = query(
      collection(db, 'pacientes'),
      orderBy('timestampCreacion', 'desc')
    );

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

        setPacientes(nuevosPacientes);
        setConectado(true);
        setUltimaActualizacion(new Date());

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const paciente = change.doc.data();
            if (paciente.triage === 'ROJO') {
              reproducirAlarmaTriageRojo();
            }
          }
        });
      },
      (error) => {
        console.error('❌ Error en listener:', error);
        setConectado(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatearHora = (timestamp) => {
    if (!timestamp) return '—';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const calcularTiempo = (timestamp) => {
    if (!timestamp) return '';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const minutos = Math.floor((new Date() - fecha) / 60000);
    if (minutos < 1) return 'ahora';
    if (minutos === 1) return 'hace 1 min';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return `hace ${horas}h`;
  };

  const getTriageClass = (triage) => {
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
          <div className="logo-box">
            <span>🚑</span>
          </div>
          <div>
            <h1>VitalSync</h1>
            <p className="subtitulo">Sala de Emergencias · Hospital San Vicente</p>
          </div>
        </div>
        <div className="header-right">
          <div className={`estado-pill ${conectado ? 'conectado' : 'desconectado'}`}>
            <span className="estado-dot"></span>
            {conectado ? 'Conectado' : 'Desconectado'}
          </div>
          <div className="ultima-actualizacion">
            Actualizado · {ultimaActualizacion ? formatearHora(ultimaActualizacion) : '—'}
          </div>
        </div>
      </header>

      {/* Estadísticas */}
      <div className="stats">
        <div className="stat-card stat-rojo">
          <div className="stat-label">Triage Rojo</div>
          <div className="stat-numero">
            {pacientes.filter(p => p.triage === 'ROJO').length}
          </div>
        </div>
        <div className="stat-card stat-amarillo">
          <div className="stat-label">Triage Amarillo</div>
          <div className="stat-numero">
            {pacientes.filter(p => p.triage === 'AMARILLO').length}
          </div>
        </div>
        <div className="stat-card stat-verde">
          <div className="stat-label">Triage Verde</div>
          <div className="stat-numero">
            {pacientes.filter(p => p.triage === 'VERDE').length}
          </div>
        </div>
        <div className="stat-card stat-total">
          <div className="stat-label">Total</div>
          <div className="stat-numero">{pacientes.length}</div>
        </div>
      </div>

      {/* Lista de pacientes */}
      <main className="contenido">
        <div className="section-header">
          <h2>Pacientes entrantes</h2>
          <span className="section-hint">Click en una tarjeta para ver detalle completo</span>
        </div>
        
        {pacientes.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icon">⏳</div>
            <p className="vacio-texto">Esperando pacientes...</p>
            <p className="vacio-subtitulo">
              Cuando una ambulancia envíe datos, aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="grid-pacientes">
            {pacientes.map((paciente) => (
              <div 
                key={paciente.id} 
                className={`tarjeta ${getTriageClass(paciente.triage)}`}
                onClick={() => setPacienteSeleccionado(paciente)}
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
                  <div className="tiempo-transcurrido">
                    {calcularTiempo(paciente.timestampCreacion)}
                  </div>

                  <div className="paciente-info">
                    <div className="info-item">
                      <span className="info-label">Edad</span>
                      <span className="info-valor">
                        {paciente.edad ? `${paciente.edad}` : '—'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Sexo</span>
                      <span className="info-valor">{paciente.sexo || '—'}</span>
                    </div>
                    <div className="info-item info-sangre">
                      <span className="info-label">Sangre</span>
                      <span className="info-valor">{paciente.tipoSangre || '—'}</span>
                    </div>
                  </div>

                  <div className="signos-vitales">
                    <div className="signo">
                      <span className="signo-label">FC</span>
                      <span className="signo-valor">
                        {paciente.frecuenciaCardiaca || '—'}
                        <small>bpm</small>
                      </span>
                    </div>
                    <div className="signo">
                      <span className="signo-label">PA</span>
                      <span className="signo-valor">
                        {paciente.presionSistolica || '—'}/{paciente.presionDiastolica || '—'}
                        <small>mmHg</small>
                      </span>
                    </div>
                  </div>

                  <div className="tarjeta-footer">
                    <span className="ambulancia">🚑 {paciente.ambulanciaId || '—'}</span>
                    <span className="paramedico">👤 {paciente.paramedicoId || '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de detalle */}
      {pacienteSeleccionado && (
        <ModalPaciente 
          paciente={pacienteSeleccionado} 
          onClose={() => setPacienteSeleccionado(null)} 
        />
      )}
    </div>
  );
}

export default App;
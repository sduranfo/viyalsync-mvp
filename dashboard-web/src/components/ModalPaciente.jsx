import './ModalPaciente.css';

function ModalPaciente({ paciente, onClose }) {
  if (!paciente) return null;

  const formatearHora = (timestamp) => {
    if (!timestamp) return '—';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calcularTiempoTranscurrido = (timestamp) => {
    if (!timestamp) return '—';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const ahora = new Date();
    const minutos = Math.floor((ahora - fecha) / 60000);
    
    if (minutos < 1) return 'Hace menos de 1 min';
    if (minutos === 1) return 'Hace 1 minuto';
    if (minutos < 60) return `Hace ${minutos} minutos`;
    
    const horas = Math.floor(minutos / 60);
    if (horas === 1) return 'Hace 1 hora';
    return `Hace ${horas} horas`;
  };

  const getTriageInfo = (triage) => {
    switch (triage) {
      case 'ROJO':
        return { 
          color: '#dc2626', 
          bg: '#fee2e2', 
          text: '#7f1d1d',
          descripcion: 'Crítico - Atención inmediata'
        };
      case 'AMARILLO':
        return { 
          color: '#f59e0b', 
          bg: '#fef3c7', 
          text: '#78350f',
          descripcion: 'Urgente - Demanda pronta atención'
        };
      case 'VERDE':
        return { 
          color: '#22c55e', 
          bg: '#dcfce7', 
          text: '#14532d',
          descripcion: 'No urgente - Estable'
        };
      default:
        return { color: '#737373', bg: '#f5f5f5', text: '#404040', descripcion: 'Sin triage' };
    }
  };

  const triageInfo = getTriageInfo(paciente.triage);

  const getSexoLabel = (sexo) => {
    switch (sexo) {
      case 'M': return 'Masculino';
      case 'F': return 'Femenino';
      case 'O': return 'Otro';
      default: return '—';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Header con triage */}
        <div 
          className="modal-header" 
          style={{ backgroundColor: triageInfo.bg, borderLeftColor: triageInfo.color }}
        >
          <div>
            <div className="modal-triage-badge" style={{ backgroundColor: triageInfo.color }}>
              TRIAGE {paciente.triage || 'SIN ASIGNAR'}
            </div>
            <h2 style={{ color: triageInfo.text }}>{triageInfo.descripcion}</h2>
            <p className="modal-id" style={{ color: triageInfo.text }}>
              ID: {paciente.idAnonimo || paciente.id}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {/* Información del paciente */}
        <div className="modal-body">
          
          <div className="modal-section">
            <h3>Información clínica básica</h3>
            <div className="modal-grid-2">
              <div className="modal-field">
                <span className="modal-field-label">Edad</span>
                <span className="modal-field-value">
                  {paciente.edad ? `${paciente.edad} años` : '—'}
                </span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Sexo</span>
                <span className="modal-field-value">{getSexoLabel(paciente.sexo)}</span>
              </div>
              <div className="modal-field modal-field-highlight">
                <span className="modal-field-label">Tipo de sangre</span>
                <span className="modal-field-value modal-field-sangre">
                  {paciente.tipoSangre || '—'}
                </span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Estado</span>
                <span className="modal-field-value">{paciente.estado || 'EN_RUTA'}</span>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h3>Signos vitales</h3>
            <div className="modal-grid-2">
              <div className="modal-field">
                <span className="modal-field-label">Frecuencia cardíaca</span>
                <span className="modal-field-value modal-field-vital">
                  {paciente.frecuenciaCardiaca || '—'} <small>bpm</small>
                </span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Presión arterial</span>
                <span className="modal-field-value modal-field-vital">
                  {paciente.presionSistolica || '—'}/{paciente.presionDiastolica || '—'} <small>mmHg</small>
                </span>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h3>Información operativa</h3>
            <div className="modal-grid-2">
              <div className="modal-field">
                <span className="modal-field-label">Ambulancia</span>
                <span className="modal-field-value">{paciente.ambulanciaId || '—'}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Paramédico</span>
                <span className="modal-field-value">{paciente.paramedicoId || '—'}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Tiempo desde registro</span>
                <span className="modal-field-value">
                  {calcularTiempoTranscurrido(paciente.timestampCreacion)}
                </span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Registrado</span>
                <span className="modal-field-value modal-field-small">
                  {formatearHora(paciente.timestampCreacion)}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}

export default ModalPaciente;
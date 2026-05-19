import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar
} from 'react-native';

import { 
  inicializarDB, 
  guardarPacienteLocal, 
  contarPendientes,
  obtenerAmbulanciaId,
  obtenerParamedicoId
} from './db/database';


import { sincronizarPendientes } from './sync/syncManager';
import { 
  iniciarMonitoreoRed, 
  detenerMonitoreoRed,
  iniciarSyncPeriodico,
  detenerSyncPeriodico
} from './sync/networkWatcher';


export default function App() {
  // Estados del formulario
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [documento, setDocumento] = useState('');
  const [triage, setTriage] = useState(null);
  const [frecuenciaCardiaca, setFrecuenciaCardiaca] = useState('');
  const [presionSistolica, setPresionSistolica] = useState('');
  const [presionDiastolica, setPresionDiastolica] = useState('');
  const [edad, setEdad] = useState('');
  const [sexo, setSexo] = useState(null);
  const [tipoSangre, setTipoSangre] = useState(null);
  
  // Estados del sistema
  const [online, setOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [ambulanciaId, setAmbulanciaId] = useState('');
  const [paramedicoId, setParamedicoId] = useState('');

  // Inicialización al arrancar la app
  useEffect(() => {
    inicializarDB();

    // Cargar IDs del dispositivo
    setAmbulanciaId(obtenerAmbulanciaId());
    setParamedicoId(obtenerParamedicoId());

    actualizarContadorPendientes();
    
    iniciarMonitoreoRed((nuevoEstado) => {
      setOnline(nuevoEstado);
      // Actualizar contador después de unos segundos para reflejar la sync
      setTimeout(actualizarContadorPendientes, 3000);
    });
    
    iniciarSyncPeriodico();
    
    // Actualizar contador cada 5 segundos para que la UI refleje los cambios
    const intervalo = setInterval(actualizarContadorPendientes, 5000);
    
    // Cleanup al desmontar (cuando se cierra la app)
    return () => {
      detenerMonitoreoRed();
      detenerSyncPeriodico();
      clearInterval(intervalo);
    };
  }, []);

  const actualizarContadorPendientes = () => {
    const total = contarPendientes();
    setPendientes(total);
  };
  // Valida los datos ANTES de guardar local
  // Devuelve null si todo está bien, o un mensaje de error si algo está mal
  const validarDatos = () => {
  if (!nombreCompleto || nombreCompleto.trim().length < 2) {
    return 'El nombre del paciente debe tener al menos 2 caracteres';
  }
  
  if (!documento || documento.trim().length < 5) {
    return 'El documento debe tener al menos 5 caracteres';
  }
  
  if (!edad) {
    return 'La edad es obligatoria';
  }
  
  const edadNum = parseInt(edad);
  if (isNaN(edadNum) || edadNum < 0 || edadNum > 150) {
    return 'Edad fuera de rango (0-150 años)';
  }
  
  if (!sexo) {
    return 'Debes seleccionar el sexo del paciente';
  }
  
  if (!tipoSangre) {
    return 'Debes seleccionar el tipo de sangre del paciente';
  }
  
  if (!triage) {
    return 'Debes seleccionar un nivel de Triage';
  }
  
  if (!frecuenciaCardiaca) {
    return 'La frecuencia cardíaca es obligatoria';
  }
  
  const fc = parseInt(frecuenciaCardiaca);
  if (isNaN(fc) || fc < 20 || fc > 250) {
    return 'Frecuencia cardíaca fuera de rango (20-250 bpm)';
  }
  
  if (presionSistolica) {
    const sistolica = parseInt(presionSistolica);
    if (isNaN(sistolica) || sistolica < 40 || sistolica > 300) {
      return 'Presión sistólica fuera de rango (40-300 mmHg)';
    }
  }
  
  if (presionDiastolica) {
    const diastolica = parseInt(presionDiastolica);
    if (isNaN(diastolica) || diastolica < 20 || diastolica > 200) {
      return 'Presión diastólica fuera de rango (20-200 mmHg)';
    }
  }
  
  if (presionSistolica && presionDiastolica) {
    const sistolica = parseInt(presionSistolica);
    const diastolica = parseInt(presionDiastolica);
    if (sistolica <= diastolica) {
      return 'La presión sistólica debe ser mayor que la diastólica';
    }
  }
  
  return null;
};

  const enviarPaciente = async () => {
    // PASO 1: Validar ANTES de guardar 
    const errorValidacion = validarDatos();
    if (errorValidacion) {
      Alert.alert('Datos inválidos', errorValidacion);
      return;
    }

    // PASO 2: Activar estado "enviando" 
    setEnviando(true);

    try {
      const requestId = uuidv4();
        const payload = {
    paciente: {
      nombreCompleto: nombreCompleto,
      documentoIdentidad: documento,
      tipoDocumento: 'CC',
      edad: parseInt(edad),
      sexo: sexo,
      tipoSangre: tipoSangre
    },
    signosVitales: {
      triage: triage,
      frecuenciaCardiaca: parseInt(frecuenciaCardiaca),
      presionSistolica: parseInt(presionSistolica) || 0,
      presionDiastolica: parseInt(presionDiastolica) || 0
    },
    ambulanciaId: ambulanciaId,
    paramedicoId: paramedicoId
  };

      // PASO 3: Guardar local INMEDIATAMENTE (siempre funciona)
      guardarPacienteLocal(requestId, payload);
      
      // PASO 4: Confirmación al usuario
      Alert.alert(
        '✓ Paciente Guardado',
        online 
          ? 'Sincronizando con el hospital...' 
          : 'Sin internet. Se enviará cuando vuelva la conexión.'
      );
      
      // PASO 5: Limpiar formulario
      setNombreCompleto('');
      setDocumento('');
      setTriage(null);
      setFrecuenciaCardiaca('');
      setPresionSistolica('');
      setPresionDiastolica('');
      setEdad('');
      setSexo(null);
      setTipoSangre(null);
      
      // PASO 6: Disparar sync en background
      sincronizarPendientes().then(() => {
        actualizarContadorPendientes();
      });
      
      // PASO 7: Actualizar contador inmediatamente
      actualizarContadorPendientes();
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el paciente: ' + error.message);
    } finally {
      // PASO 8: SIEMPRE desactivar el estado de "enviando", aunque haya error
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Banner de estado */}
      <View style={[styles.banner, online ? styles.bannerOnline : styles.bannerOffline]}>
        <Text style={styles.bannerText}>
          {online ? '📶 Online' : '📴 Sin conexión'}
          {pendientes > 0 && ` • ${pendientes} pendiente${pendientes > 1 ? 's' : ''}`}
        </Text>
      </View>

      <ScrollView style={styles.scrollContent}>
        <Text style={styles.titulo}>VitalSync 🚑</Text>
        <Text style={styles.subtitulo}>Registro de Paciente</Text>
        <View style={styles.idBadge}>
          <Text style={styles.idBadgeText}>
            🚑 {ambulanciaId || '...'} · 👤 {paramedicoId || '...'}
          </Text>
        </View>

        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          value={nombreCompleto}
          onChangeText={setNombreCompleto}
          placeholder="Juan Pérez"
        />

        <Text style={styles.label}>Documento</Text>
        <TextInput
          style={styles.input}
          value={documento}
          onChangeText={setDocumento}
          placeholder="1234567890"
          keyboardType="numeric"
        />
        <Text style={styles.label}>Edad</Text>
        <TextInput
          style={styles.input}
          value={edad}
          onChangeText={setEdad}
          placeholder="35"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Sexo</Text>
        <View style={styles.opcionesGroup}>
          {[
            { valor: 'M', label: 'Masculino' },
            { valor: 'F', label: 'Femenino' },
            { valor: 'O', label: 'Otro' }
          ].map((opcion) => (
            <TouchableOpacity
              key={opcion.valor}
              style={[
                styles.opcionBtn,
                sexo === opcion.valor && styles.opcionBtnActivo
              ]}
              onPress={() => setSexo(opcion.valor)}
            >
              <Text style={[
                styles.opcionBtnText,
                sexo === opcion.valor && styles.opcionBtnTextActivo
              ]}>
                {opcion.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Tipo de sangre</Text>
        <View style={styles.tipoSangreGrid}>
          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'DESCONOCIDO'].map((tipo) => (
            <TouchableOpacity
              key={tipo}
              style={[
                styles.tipoSangreBtn,
                tipoSangre === tipo && styles.tipoSangreBtnActivo
              ]}
              onPress={() => setTipoSangre(tipo)}
            >
              <Text style={[
                styles.tipoSangreBtnText,
                tipoSangre === tipo && styles.tipoSangreBtnTextActivo
              ]}>
                {tipo === 'DESCONOCIDO' ? '?' : tipo}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Nivel de Triage</Text>
        <View style={styles.triageGroup}>
          {['ROJO', 'AMARILLO', 'VERDE'].map((nivel) => (
            <TouchableOpacity
              key={nivel}
              style={[
                styles.triageBtn,
                triage === nivel && styles.triageBtnActivo,
                triage === nivel && { backgroundColor: 
                  nivel === 'ROJO' ? '#dc2626' : 
                  nivel === 'AMARILLO' ? '#facc15' : '#16a34a' }
              ]}
              onPress={() => setTriage(nivel)}
            >
              <Text style={[
                styles.triageBtnText,
                triage === nivel && styles.triageBtnTextActivo
              ]}>
                {nivel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Frecuencia cardíaca (bpm)</Text>
        <TextInput
          style={styles.input}
          value={frecuenciaCardiaca}
          onChangeText={setFrecuenciaCardiaca}
          placeholder="80"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Presión sistólica</Text>
        <TextInput
          style={styles.input}
          value={presionSistolica}
          onChangeText={setPresionSistolica}
          placeholder="120"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Presión diastólica</Text>
        <TextInput
          style={styles.input}
          value={presionDiastolica}
          onChangeText={setPresionDiastolica}
          placeholder="80"
          keyboardType="numeric"
        />

        <TouchableOpacity 
          style={[styles.botonEnviar, enviando && styles.botonEnviarDesactivado]} 
          onPress={enviarPaciente}
          disabled={enviando}
          activeOpacity={0.7}
        >
          <Text style={styles.botonEnviarText}>
            {enviando ? '⏳ GUARDANDO...' : 'GUARDAR PACIENTE'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  banner: { 
    paddingVertical: 12, 
    paddingHorizontal: 16,
    paddingTop: 50 // Para que no choque con la barra de estado
  },
  bannerOnline: { backgroundColor: '#16a34a' },
  bannerOffline: { backgroundColor: '#dc2626' },
  bannerText: { color: 'white', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  scrollContent: { flex: 1, padding: 20 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginTop: 10 },
  subtitulo: { fontSize: 16, color: '#6b7280', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    fontSize: 16
  },
  triageGroup: { flexDirection: 'row', gap: 8 },
  triageBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center'
  },
  triageBtnActivo: { borderColor: 'transparent' },
  triageBtnText: { fontWeight: 'bold', color: '#6b7280' },
  triageBtnTextActivo: { color: 'white' },
  botonEnviar: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center'
  },
  botonEnviarDesactivado: { 
    backgroundColor: '#9ca3af',
    opacity: 0.7
  },
  opcionesGroup: { 
  flexDirection: 'row', 
  gap: 8 
},
opcionBtn: {
  flex: 1,
  padding: 12,
  borderRadius: 8,
  backgroundColor: 'white',
  borderWidth: 1,
  borderColor: '#d1d5db',
  alignItems: 'center'
},
opcionBtnActivo: { 
  borderColor: '#2563eb',
  backgroundColor: '#2563eb'
},
opcionBtnText: { 
  fontWeight: '600', 
  color: '#6b7280',
  fontSize: 13
},
opcionBtnTextActivo: { 
  color: 'white' 
},
tipoSangreGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 6
},
tipoSangreBtn: {
  width: '31%',
  padding: 10,
  borderRadius: 8,
  backgroundColor: 'white',
  borderWidth: 1,
  borderColor: '#d1d5db',
  alignItems: 'center'
},
tipoSangreBtnActivo: { 
  borderColor: '#dc2626',
  backgroundColor: '#dc2626'
},
tipoSangreBtnText: { 
  fontWeight: 'bold', 
  color: '#374151',
  fontSize: 14
},
tipoSangreBtnTextActivo: { 
  color: 'white' 
},
idBadge: {
  backgroundColor: '#e0e7ff',
  padding: 10,
  borderRadius: 8,
  marginTop: 8,
  marginBottom: 8,
  borderLeftWidth: 4,
  borderLeftColor: '#4f46e5'
},
idBadgeText: {
  fontSize: 13,
  fontWeight: '600',
  color: '#4338ca',
  fontFamily: 'monospace'
},
  botonEnviarText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
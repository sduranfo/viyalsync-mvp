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

import { inicializarDB, guardarPacienteLocal, contarPendientes } from './db/database';
import { sincronizarPendientes } from './sync/syncManager';
import { 
  iniciarMonitoreoRed, 
  detenerMonitoreoRed,
  iniciarSyncPeriodico,
  detenerSyncPeriodico
} from './sync/networkWatcher';

const AMBULANCIA_ID = 'AMB-007';
const PARAMEDICO_ID = 'PARAMEDICO-12';

export default function App() {
  // Estados del formulario
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [documento, setDocumento] = useState('');
  const [triage, setTriage] = useState(null);
  const [frecuenciaCardiaca, setFrecuenciaCardiaca] = useState('');
  const [presionSistolica, setPresionSistolica] = useState('');
  const [presionDiastolica, setPresionDiastolica] = useState('');
  
  // Estados del sistema
  const [online, setOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);

  // Inicialización al arrancar la app
  useEffect(() => {
    inicializarDB();
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
    
    // Las presiones son opcionales en este MVP, pero si están, deben ser válidas
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
    
    // Si ambas están definidas, validar relación lógica
    if (presionSistolica && presionDiastolica) {
      const sistolica = parseInt(presionSistolica);
      const diastolica = parseInt(presionDiastolica);
      if (sistolica <= diastolica) {
        return 'La presión sistólica debe ser mayor que la diastólica';
      }
    }
    
    return null; // todo OK
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
          tipoDocumento: 'CC'
        },
        signosVitales: {
          triage: triage,
          frecuenciaCardiaca: parseInt(frecuenciaCardiaca),
          presionSistolica: parseInt(presionSistolica) || 0,
          presionDiastolica: parseInt(presionDiastolica) || 0
        },
        ambulanciaId: AMBULANCIA_ID,
        paramedicoId: PARAMEDICO_ID
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
  botonEnviarText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
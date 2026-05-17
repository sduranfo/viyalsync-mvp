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

  // Botón ENVIAR: ahora guarda LOCAL primero
  const enviarPaciente = async () => {
    if (!nombreCompleto || !documento || !triage || !frecuenciaCardiaca) {
      Alert.alert('Campos faltantes', 'Completa todos los campos obligatorios');
      return;
    }

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

      // 1. Guardar local INMEDIATAMENTE (siempre funciona)
      guardarPacienteLocal(requestId, payload);
      
      Alert.alert(
        '✓ Paciente Guardado',
        online 
          ? 'Sincronizando con el hospital...' 
          : 'Sin internet. Se enviará cuando vuelva la conexión.'
      );
      
      // 2. Limpiar formulario (la sync corre en background)
      setNombreCompleto('');
      setDocumento('');
      setTriage(null);
      setFrecuenciaCardiaca('');
      setPresionSistolica('');
      setPresionDiastolica('');
      
      // 3. Disparar sync (no esperamos a que termine)
      sincronizarPendientes().then(() => {
        actualizarContadorPendientes();
      });
      
      // 4. Actualizar contador inmediatamente
      actualizarContadorPendientes();
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el paciente: ' + error.message);
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

        <TouchableOpacity style={styles.botonEnviar} onPress={enviarPaciente}>
          <Text style={styles.botonEnviarText}>GUARDAR PACIENTE</Text>
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
  botonEnviarText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
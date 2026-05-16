import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';

// ⚠️ IMPORTANTE: reemplaza con tu IP local
// Para encontrarla, ejecuta en CMD: ipconfig
// Busca tu IPv4, algo como 192.168.1.X
const BACKEND_URL = 'http://192.168.1.11:5001/vitalsync-mvp/us-central1/registrarSignosVitales';

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
  const [enviando, setEnviando] = useState(false);

  // Función para enviar al backend
  const enviarPaciente = async () => {
    // Validación básica
    if (!nombreCompleto || !documento || !triage || !frecuenciaCardiaca) {
      Alert.alert('Campos faltantes', 'Completa todos los campos obligatorios');
      return;
    }

    setEnviando(true);

    try {
      const requestId = uuidv4();

      const respuesta = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
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
        })
      });

      const data = await respuesta.json();

      if (data.exito) {
        Alert.alert(
          '✓ Paciente Registrado',
          `ID: ${data.idAnonimo.substring(0, 8)}...\n\nEl hospital ya fue notificado.`
        );
        // Limpiar el formulario
        setNombreCompleto('');
        setDocumento('');
        setTriage(null);
        setFrecuenciaCardiaca('');
        setPresionSistolica('');
        setPresionDiastolica('');
      } else {
        Alert.alert('Error', data.error || 'No se pudo registrar');
      }
    } catch (error) {
      Alert.alert(
        'Error de conexión',
        'No se pudo conectar al servidor. Verifica tu red.'
      );
      console.error(error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a3a5c" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚑 VitalSync</Text>
        <Text style={styles.headerSubtitle}>Ambulancia {AMBULANCIA_ID}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Sección Paciente */}
        <Text style={styles.sectionTitle}>Datos del Paciente</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          value={nombreCompleto}
          onChangeText={setNombreCompleto}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Documento de identidad"
          value={documento}
          onChangeText={setDocumento}
          keyboardType="numeric"
        />

        {/* Sección Triage */}
        <Text style={styles.sectionTitle}>Nivel de Triage</Text>
        
        <View style={styles.triageContainer}>
          <TouchableOpacity
            style={[
              styles.triageButton,
              styles.triageRojo,
              triage === 'ROJO' && styles.triageSelected
            ]}
            onPress={() => setTriage('ROJO')}
          >
            <Text style={styles.triageText}>🔴 ROJO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.triageButton,
              styles.triageAmarillo,
              triage === 'AMARILLO' && styles.triageSelected
            ]}
            onPress={() => setTriage('AMARILLO')}
          >
            <Text style={styles.triageText}>🟡 AMARILLO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.triageButton,
              styles.triageVerde,
              triage === 'VERDE' && styles.triageSelected
            ]}
            onPress={() => setTriage('VERDE')}
          >
            <Text style={styles.triageText}>🟢 VERDE</Text>
          </TouchableOpacity>
        </View>

        {/* Sección Signos Vitales */}
        <Text style={styles.sectionTitle}>Signos Vitales</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Frecuencia cardíaca (lpm)"
          value={frecuenciaCardiaca}
          onChangeText={setFrecuenciaCardiaca}
          keyboardType="numeric"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Presión sistólica"
          value={presionSistolica}
          onChangeText={setPresionSistolica}
          keyboardType="numeric"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Presión diastólica"
          value={presionDiastolica}
          onChangeText={setPresionDiastolica}
          keyboardType="numeric"
        />

        {/* Botón Enviar */}
        <TouchableOpacity
          style={[styles.botonEnviar, enviando && styles.botonDeshabilitado]}
          onPress={enviarPaciente}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonEnviarTexto}>ENVIAR AL HOSPITAL</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    backgroundColor: '#1a3a5c',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#a0c4e0',
    fontSize: 14,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a3a5c',
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d0d8e0',
  },
  triageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  triageButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    opacity: 0.6,
  },
  triageRojo: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  triageAmarillo: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
    borderWidth: 2,
  },
  triageVerde: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
    borderWidth: 2,
  },
  triageSelected: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  triageText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  botonEnviar: {
    backgroundColor: '#1a3a5c',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  botonDeshabilitado: {
    backgroundColor: '#94a3b8',
  },
  botonEnviarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
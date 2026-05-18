// Genera un sonido de alarma médica usando Web Audio API
// No requiere archivos externos, todo es sintético

let audioContext = null;

const obtenerContexto = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

export const reproducirAlarmaTriageRojo = () => {
  try {
    const ctx = obtenerContexto();
    const ahora = ctx.currentTime;

    // Patrón de alarma médica: 3 pitidos cortos
    const frecuencias = [880, 1100, 880]; // notas musicales: A5, C#6, A5
    const duracionPitido = 0.15; // segundos
    const pausa = 0.1;

    frecuencias.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine'; // sonido limpio tipo flauta
      oscillator.frequency.value = freq;

      const inicio = ahora + index * (duracionPitido + pausa);
      const fin = inicio + duracionPitido;

      // Envelope: subida rápida, bajada suave (evita el "click" inicial)
      gainNode.gain.setValueAtTime(0, inicio);
      gainNode.gain.linearRampToValueAtTime(0.3, inicio + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, fin);

      oscillator.start(inicio);
      oscillator.stop(fin);
    });

    console.log('🔊 Alarma Triage Rojo reproducida');
  } catch (error) {
    console.error('Error reproduciendo alarma:', error);
  }
};
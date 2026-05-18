# ADR-007: Reintentos con backoff exponencial para HIS Legacy

## Estado
 Aceptado — Día 9 del desarrollo

## Contexto

El driver **E07** describe un escenario común en sistemas distribuidos:

> "¿Qué pasa si el servidor HIS del hospital está caído cuando llega la ambulancia?"

El HIS es un sistema legacy del hospital con disponibilidad limitada (~95% mensual según 
SLA acordado). Caídas temporales de 30s a 5 minutos son comunes durante mantenimientos 
o picos de carga.

Sin reintentos, cualquier fallo transitorio resultaría en pérdida del resumen clínico, 
forzando intervención manual del equipo médico.

## Decisión

Implementar **reintentos automáticos con backoff exponencial** en el worker `workerEnviarHIS`, 
con las siguientes características:

1. **Máximo 3 reintentos** por ejecución del worker
2. **Tiempos de espera**: 2s, 4s, 8s (exponencial base 2)
3. **Distinción entre errores transitorios y permanentes**:
   - **4xx (cliente)**: NO reintentar, marcar como `FALLIDO_PERMANENTE`
   - **5xx (servidor)**: reintentar con backoff
4. **Tope total de 10 intentos** sumando todas las ejecuciones del worker
5. **Función reutilizable** `fetchConReintentos()` para no duplicar lógica

```javascript
const resultado = await fetchConReintentos(URL_HIS, opciones, 3);
```

## Alternativas consideradas

### A. Reintentos con espera fija
- **Contra:** Si el HIS está caído, bombardear cada 1s lo mantiene caído (efecto 
  estampida). Si el HIS responde lento, espera fija desperdicia tiempo.
- **Razón de descarte:** Backoff exponencial es estándar de la industria (RFC 7231)

### B. Sin reintentos (fail-fast)
- **Contra:** Cualquier glitch transitorio = pérdida de datos clínicos
- **Razón de descarte:** Inaceptable en contexto médico

### C. Reintentos infinitos
- **Contra:** Un paciente con datos malformados (4xx) bloquearía la cola indefinidamente
- **Razón de descarte:** Necesita tope para errores permanentes

### D. Circuit Breaker pattern (Hystrix-style)
- **Pro:** Más sofisticado, deja de intentar si detecta caída prolongada
- **Contra:** Sobreingeniería para el MVP
- **Razón de descarte:** Backoff con tope cumple objetivo con menos complejidad

## Consecuencias

### Positivas
-  Cumple driver E07: el sistema se recupera automáticamente de caídas hasta 30s
-  Backoff exponencial evita efecto estampida que empeoraría caídas
-  Distinción 4xx/5xx evita reintentos inútiles para datos malformados
-  Tiempo máximo de espera por ejecución: 14 segundos (2+4+8)
-  Patrón estándar y defendible ante auditoría técnica

### Negativas / Trade-offs
-  Latencia incrementada en escenarios de falla: hasta 14s antes de marcar FALLIDO
-  Documentos con errores permanentes (4xx) requieren intervención manual para 
  diagnosticar (mitigado por logs detallados)
-  Si el HIS está caído > 10 minutos (10 reintentos × 1 minuto worker), los pacientes 
  quedan FALLIDOS y requieren reproceso manual

## Implementación

```javascript
const fetchConReintentos = async (url, opciones, maxIntentos = 3) => {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const respuesta = await fetch(url, opciones);
      if (respuesta.ok) return { exito: true, intento, respuesta };
      
      if (respuesta.status >= 400 && respuesta.status < 500) {
        return { exito: false, intento, permanente: true };
      }
      throw new Error(`HTTP ${respuesta.status}`);
    } catch (error) {
      if (intento === maxIntentos) return { exito: false, error };
      await dormir(Math.pow(2, intento) * 1000);
    }
  }
};
```

## Referencias
- Driver E07: Resilencia ante HIS caído
- Driver E18: Mismo patrón aplicable a Gateway SMS (futuro)
- RFC 7231 — HTTP Retry semantics
- Google SRE Book — Cap. 22: Addressing Cascading Failures
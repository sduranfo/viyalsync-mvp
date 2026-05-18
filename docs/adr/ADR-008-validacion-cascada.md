# ADR-008: Validación en cascada (cliente + backend)

## Estado
 Aceptado — Día 9 del desarrollo

## Contexto

El sistema VitalSync procesa datos médicos críticos donde un valor erróneo 
(ej: frecuencia cardíaca = -50 bpm) puede:

1. **Romper el dashboard** o disparar alertas falsas
2. **Causar decisiones médicas incorrectas** si el cirujano confía en datos sin validar
3. **Almacenar datos basura** en Firestore aumentando costos

Adicionalmente, una validación SOLO en el cliente es insegura (un atacante puede llamar 
al backend directamente con curl). Una validación SOLO en el backend genera mala UX 
(el paramédico solo se entera del error después de tocar "Guardar").

## Decisión

Implementar **validación en dos capas independientes** (defense in depth):

### Capa 1: Cliente (app móvil)
- Validación **antes de guardar en SQLite**
- Función `validarDatos()` retorna mensaje de error específico
- Feedback inmediato al paramédico vía `Alert.alert()`
- **Propósito**: UX y evitar congestionar el backend con datos inválidos

### Capa 2: Backend (Cloud Function)
- Validación al inicio de `registrarSignosVitales` antes de cualquier escritura
- Responde con `400 Bad Request` y mensaje de error si falla
- **Propósito**: Seguridad (cliente no es de confianza) y consistencia de datos

### Rangos validados (idénticos en ambas capas):

| Campo | Rango | Justificación clínica |
|---|---|---|
| Frecuencia cardíaca | 20-250 bpm | Fuera de rango = fisiológicamente imposible |
| Presión sistólica | 40-300 mmHg | Mínimo en shock irreversible / máximo no registrado |
| Presión diastólica | 20-200 mmHg | Rangos extremos pero posibles en emergencias |
| Sistólica > Diastólica | Siempre | Físicamente imposible al revés |
| Triage | {ROJO, AMARILLO, VERDE} | Enum cerrado |
| Documento | length ≥ 5 | Mínimo realista colombiano (cédula de extranjería) |

## Alternativas consideradas

### A. Validación solo en cliente
- **Contra:** Un atacante con curl envía datos inválidos al backend, contamina Firestore
- **Razón de descarte:** Inseguro

### B. Validación solo en backend
- **Contra:** El paramédico llena el formulario, lo envía, espera, recibe error. Pérdida 
  de tiempo en emergencias.
- **Razón de descarte:** UX inaceptable

### C. Validación con librería compartida (mismo código cliente y backend)
- **Pro:** Single source of truth
- **Contra:** Requiere monorepo o paquete npm interno
- **Razón de descarte:** Sobreingeniería para MVP. Las dos capas se mantienen sincronizadas 
  por convención y revisión de código.

## Consecuencias

### Positivas
-  El paramédico recibe feedback inmediato (UX positiva)
-  El backend está protegido contra ataques o bugs del cliente (seguridad)
-  Rangos médicamente justificados, no arbitrarios
-  Mensajes de error específicos facilitan corrección rápida
-  Datos en Firestore garantizados consistentes (cualquier read en el dashboard es válido)

### Negativas / Trade-offs
-  **Duplicación de lógica**: rangos definidos en dos archivos diferentes
-  Riesgo de **desincronización**: si se cambia un rango en un lado y se olvida el otro, 
  comportamiento inconsistente
-  Mitigación actual: comentarios cruzados en ambos archivos referenciando este ADR

## Manejo de errores 4xx en el cliente

El worker de sincronización distingue entre 4xx (permanente) y 5xx (transitorio):

- **4xx**: el paciente se marca como `FALLIDO_PERMANENTE` en SQLite, NO se reintenta
- **5xx**: se reintenta con backoff (ver ADR-007)

Esto evita que datos inválidos se queden reintentándose en bucle infinito.

## TODO pendiente (post-MVP)

- Extraer las reglas de validación a un archivo compartido `validaciones.js` que pueda 
  ser consumido por ambos (cliente y backend) vía un paquete npm interno o submódulo git.
- Mostrar al paramédico una pantalla de "Pacientes con errores" para los FALLIDO_PERMANENTE.

## Referencias
- Driver implícito de Calidad: integridad de datos
- Driver E05: las validaciones también previenen logs con datos basura
- Patrón: Defense in Depth (OWASP)
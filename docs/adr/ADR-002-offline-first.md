# ADR-002: Patrón Offline-First con SQLite local en la app móvil

## Estado
 Aceptado — Día 7 del desarrollo

## Contexto

El driver **E01** es uno de los tres escenarios bloqueantes de vida del proyecto 
(calificación H,H en la matriz de priorización). El Capitán Ramírez, jefe de paramédicos, 
fue categórico:

> "La aplicación móvil no puede bloquearse ni mostrar mensajes de error cuando no haya 
> internet. El paramédico debe poder seguir ingresando datos fuera de línea, y el sistema 
> debe sincronizar automáticamente al recuperar conexión, garantizando que ningún paquete 
> de datos clínicos se pierda."

Las ambulancias operan en zonas montañosas, sótanos y áreas rurales sin cobertura 3G/4G 
durante periodos de 5 a 30 minutos. Si la app dependiera de internet, los datos 
clínicos se perderían.

## Decisión

Implementar el patrón **Offline-First** en la app móvil con:

1. **Base de datos local SQLite** (`expo-sqlite`) con tabla `pacientes_locales` 
   que almacena cada registro con estado `PENDIENTE` o `ENVIADO`.
2. **Worker de sincronización** que detecta conexión y procesa la cola secuencialmente.
3. **Detector de red** (`@react-native-community/netinfo`) que dispara sincronización 
   automática al recuperar conexión.
4. **Sincronización periódica** cada 30 segundos como respaldo.

El flujo es: la app **siempre guarda local primero** (operación instantánea que no falla 
por red) y luego intenta sincronizar en segundo plano.

## Alternativas consideradas

### A. AsyncStorage de React Native
- **Pro:** Más simple, no requiere SQL
- **Contra:** No soporta queries complejos, sin transacciones, sin índices
- **Razón de descarte:** Para >100 registros pendientes la performance degrada

### B. Mostrar error cuando no hay conexión
- **Razón de descarte:** Viola directamente el requerimiento de Ramírez (driver E01)

### C. Sincronización solo manual al recuperar señal
- **Razón de descarte:** Requiere acción del paramédico, que está atendiendo al paciente

## Consecuencias

### Positivas
-  Cumple driver E01: cero paquetes perdidos en zonas sin cobertura
-  La app **nunca se bloquea** independientemente de la red
-  Cumple driver E14 indirectamente (datos persisten aunque la app crashee)
-  Soporta el escenario realista de túneles, montañas y sótanos
-  Patrón estándar de la industria (apps como Notion, Gmail lo usan)

### Negativas / Trade-offs
-  Aumenta complejidad: dos fuentes de verdad (SQLite local + Firestore)
-  Requiere idempotencia obligatoria en el backend (resuelto en ADR-003)
-  Posibles conflictos de datos si dos paramédicos editan el mismo paciente 
  (no aplica en MVP — un paciente es de una sola ambulancia)
-  Aumenta tamaño del bundle de la app móvil (~500KB adicionales)

## Referencias
- Driver E01: Operación offline en zonas sin cobertura
- ADR-003: Idempotencia (necesaria para que este patrón funcione)
- Patrón: PouchDB / CouchDB sync philosophy
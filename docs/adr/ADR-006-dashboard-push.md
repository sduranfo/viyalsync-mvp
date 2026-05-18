# ADR-006: Dashboard en tiempo real con onSnapshot (push) en lugar de polling

## Estado
 Aceptado — Día 8 del desarrollo

## Contexto

El driver **E02** es la prioridad #1 del árbol de utilidad (votación 5/5, calificación H,H):

> "El paramédico envía signos vitales y el dashboard de la sala de emergencias se 
> actualiza automáticamente, **sin refresh manual**, **en menos de 3 segundos**, mostrando 
> alerta visual y sonora."

Los cirujanos no pueden estar refrescando el navegador cada 5 segundos. El sistema debe 
notificar al dashboard cuando lleguen nuevos pacientes.

## Decisión

Usar **`onSnapshot` de Firestore** (suscripción push real) en el dashboard web React.

```javascript
const q = query(collection(db, 'pacientes'), orderBy('timestampCreacion', 'desc'));

const unsubscribe = onSnapshot(q, (snapshot) => {
  // Se ejecuta automáticamente cada vez que cambia algo en /pacientes
  setPacientes(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
});
```

Firestore mantiene una **conexión WebSocket persistente** con el cliente y le envía 
diffs de cambios en tiempo real.

## Alternativas consideradas

### A. Polling (refresh periódico)
```javascript
setInterval(() => fetch('/api/pacientes').then(updateUI), 3000);
```
- **Pro:** Simple de implementar, funciona en cualquier backend
- **Contra:** 
  - Genera 20 requests/minuto por dashboard × N dashboards = ineficiente
  - Latencia promedio = intervalo/2 = 1.5s (cerca del límite de 3s)
  - Aumenta costo (cada poll consume cuota de Firestore)
- **Razón de descarte:** Ineficiencia y latencia variable

### B. WebSockets manuales con Socket.io
- **Pro:** Control total sobre los eventos
- **Contra:** Requiere servidor dedicado (IaaS prohibido, ver ADR-001), gestión de 
  conexiones, reconexión, autenticación
- **Razón de descarte:** Reinventar la rueda; Firestore ya provee WebSockets internamente

### C. Server-Sent Events (SSE)
- **Pro:** HTTP estándar, simple
- **Contra:** Unidireccional, Firebase no expone SSE nativamente
- **Razón de descarte:** Firestore push es superior

## Consecuencias

### Positivas
-  Cumple driver E02 con holgura: latencia medida típica **600-1200ms** (mucho menor a 3s)
-  Sin refresh manual, sin polling, eficiencia óptima
-  El navegador recibe **solo los diffs** (no todo el dataset)
-  Funciona automáticamente con reconexión si se pierde la conexión
-  `snapshot.docChanges()` permite detectar específicamente pacientes nuevos para 
  disparar la alarma sonora Triage ROJO
-  Sin necesidad de servidor backend dedicado para tiempo real

### Negativas / Trade-offs
-  **Vendor lock-in con Firestore**: migrar a otra BD requeriría reimplementar el 
  patrón push (mitigado por mantener la lógica de UI separada del listener)
-  Conexión WebSocket persistente consume batería en dispositivos móviles (no aplica 
  porque el dashboard corre en monitores fijos del hospital)
-  Si el cliente pierde conexión por > 30 minutos, Firestore puede requerir reconexión 
  manual (mitigado por el SDK automáticamente)

## Latencia medida

Pruebas en desarrollo (50 ambulancias simuladas, red estándar):
- **Mediana**: 850ms
- **P99**: 1.8s
- **Máximo observado**: 2.4s

Bien dentro del límite de 3s del driver E02.

## Referencias
- Driver E02: Latencia dashboard < 3 segundos
- Firebase Firestore Realtime Updates documentation
# ADR-003: Idempotencia mediante requestId UUID generado en el cliente

## Estado
 Aceptado — Día 3 del desarrollo

## Contexto

Dos escenarios del árbol de utilidad obligan a manejar idempotencia:

- **E11**: Tras un periodo offline, la app móvil reintenta enviar paquetes. Por timeouts 
  o errores de red, un mismo paquete puede llegar al backend múltiples veces. **Si no se 
  detecta, aparecerían pacientes duplicados en el dashboard.**
- **E12**: Si el paramédico presiona el botón "Enviar" dos veces por accidente (por estrés 
  o por respuesta lenta de la app), el sistema debe registrar solo uno.

Sin idempotencia, el dashboard mostraría el mismo paciente 2-10 veces, lo cual es 
inaceptable en una sala de emergencias.

## Decisión

Implementar idempotencia con **UUIDs v4 generados en el cliente** (no en el servidor):

1. La app móvil genera un `requestId` con `uuidv4()` en el momento exacto en que el 
   paramédico toca "Guardar".
2. Ese mismo `requestId` se guarda en SQLite y se envía al backend.
3. En reintentos, **se reusa el mismo `requestId`** (nunca se genera uno nuevo).
4. El backend, antes de procesar, consulta Firestore: si ya existe un documento con ese 
   `requestId`, devuelve el resultado anterior (con flag `duplicado: true`).

## Alternativas consideradas

### A. UUID generado en el servidor
- **Contra:** Si el cliente reintenta tras un timeout, el servidor genera un UUID nuevo 
  cada vez y se crean duplicados
- **Razón de descarte:** No resuelve el problema fundamental

### B. Hash determinístico de los datos del paciente
- **Pro:** No requiere campo adicional
- **Contra:** Dos pacientes distintos con mismos signos vitales se considerarían 
  duplicados. Vital cuando hay accidente masivo con víctimas similares.
- **Razón de descarte:** Falsos positivos peligrosos

### C. Lock optimista con timestamp + paramedicoId
- **Contra:** Ventana de carrera si el paramédico envía dos pacientes en menos de 1ms 
  (técnicamente posible con doble-tap accidental)
- **Razón de descarte:** Menos robusto que UUID

## Consecuencias

### Positivas
-  Cumple driver E11 (sincronización sin duplicados)
-  Cumple driver E12 (protección ante doble-tap)
-  Probabilidad de colisión UUID v4: 1 en 2^122 (prácticamente cero)
-  Permite reintentos infinitos del lado cliente sin riesgo
-  El `requestId` también sirve para trazabilidad/debugging

### Negativas / Trade-offs
-  Agrega un campo extra (`requestId`, 36 chars) por documento
-  Requiere índice en Firestore en el campo `requestId` para query rápido
-  La app cliente debe garantizar persistencia del `requestId` (resuelto al guardarlo 
  en SQLite con `UNIQUE` constraint)

## Implementación

**Cliente** (`app-movil/App.js`):
```javascript
const requestId = uuidv4();
guardarPacienteLocal(requestId, payload);
```

**Backend** (`functions/index.js`):
```javascript
const existente = await db.collection("pacientes")
  .where("requestId", "==", datos.requestId)
  .limit(1).get();
if (!existente.empty) return res.status(200).json({duplicado: true});
```

## Referencias
- Driver E11: Sincronización sin duplicados
- Driver E12: Protección ante doble-tap
- ADR-002: Offline-first (genera la necesidad de esta decisión)
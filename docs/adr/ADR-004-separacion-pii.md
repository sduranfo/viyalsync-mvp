# ADR-004: Separación de PII (Información Personal Identificable) en colección dedicada

## Estado
 Aceptado — Día 3 del desarrollo

## Contexto

El CISO Roberto Silva impuso una regla derivada de la Ley Estatutaria de Salud 
(equivalente local a HIPAA):

> "Si un desarrollador técnico debe revisar los registros de errores de la base de datos 
> para depurar el software, los nombres y documentos de identidad de los pacientes deben 
> estar enmascarados o separados lógicamente de los datos médicos. Un programador podía 
> ver que un 'Paciente X' tenía taquicardia, pero jamás debía poder leer su nombre real."

Este es el driver **E05** del árbol de utilidad: prevenir exposición de PII en logs y 
operaciones de depuración.

## Decisión

Separar los datos en **dos colecciones independientes de Firestore**:

1. **`/pacientes`** — datos médicos anonimizados
   - `idAnonimo` (UUID): identificador interno
   - `triage`, `frecuenciaCardiaca`, `presionSistolica`, `presionDiastolica`
   - `ambulanciaId`, `paramedicoId`, `estado`, `requestId`, timestamps
   - **NO contiene nombre ni documento**

2. **`/pacientes_pii`** — datos personales identificables
   - `idAnonimo` (mismo que en `/pacientes`, sirve como FK lógica)
   - `nombreCompleto`, `documentoIdentidad`, `tipoDocumento`
   - **Acceso restringido** por reglas de Firestore

El **dashboard solo lee** de `/pacientes` (datos anonimizados). El backend, cuando 
necesita el nombre real (por ejemplo para SMS), hace un JOIN lógico consultando `/pacientes_pii`.

## Alternativas consideradas

### A. Un solo documento con todos los campos
- **Contra:** Cualquier query, log o backup expone PII automáticamente
- **Razón de descarte:** Viola directamente el requerimiento de Silva

### B. Encriptación a nivel de campo (campos PII encriptados con clave separada)
- **Pro:** Datos juntos pero PII ilegible sin clave
- **Contra:** Complejidad operativa: rotación de claves, recuperación, KMS
- **Razón de descarte:** Sobreingeniería para el MVP

### C. Tokenización (reemplazar nombre por token en producción)
- **Contra:** Requiere servicio dedicado de tokenización
- **Razón de descarte:** Sobreingeniería, separación lógica es suficiente

## Consecuencias

### Positivas
-  Cumple driver E05: logs y queries no exponen PII por defecto
-  Las reglas de Firestore bloquean lectura directa de `/pacientes_pii` desde clientes
-  Si un desarrollador debuggea el dashboard, no ve nombres reales
-  Cumple Ley Estatutaria de Salud sobre minimización de exposición de datos
-  Reduce superficie de ataque: comprometer la colección `/pacientes` no entrega PII

### Negativas / Trade-offs
-  Cuando se necesita el nombre (ej: SMS al cirujano), requiere 2 queries
-  Posibilidad de inconsistencia: documento en `/pacientes` sin contraparte en 
  `/pacientes_pii` (mitigado por escribir ambas en la misma Cloud Function transaccional)
-  Backup/restore requiere coordinar ambas colecciones

## Reglas de Firestore aplicadas

```javascript
match /pacientes/{pacienteId} {
  allow read: if true;     // dashboard lee anonimizado
  allow write: if false;   // solo backend escribe
}

match /pacientes_pii/{pacienteId} {
  allow read: if false;    // bloqueado a clientes
  allow write: if false;   // solo backend escribe
}
```

## Referencias
- Driver E05: Anonimización en logs
- Ley Estatutaria de Salud (equivalente local a HIPAA)
- Patrón: Data Separation for Privacy
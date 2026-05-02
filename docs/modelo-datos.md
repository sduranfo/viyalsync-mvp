# Modelo de Datos - VitalSync MVP

## Colecciones

### pacientes
Datos médicos del paciente. Accesible al dashboard y a logs.
- Clave: idAnonimo (UUID)
- Cumple driver: E05 (no contiene PII)

### pacientes_pii
Información personal identificable. Aislada por seguridad.
- Clave: idAnonimo (misma que pacientes)
- Cumple driver: E05 (anonimización en logs)
- Acceso: solo Cloud Functions

### cola_his
Cola de mensajes pendientes de envío al HIS legacy.
- Cumple driver: E06 (throttling 2 req/seg)
- Worker programado consume 2 docs por segundo

### alertas_sms
Alertas para cirujanos cuando hay triage ROJO.
- Trigger: creación automática cuando triage = ROJO
- Cumple parcialmente: requisito del Capitán Ramírez
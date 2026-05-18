# ADR-005: Cola con throttling para integración con HIS Legacy

## Estado
 Aceptado — Día 4 del desarrollo

## Contexto

El driver **E06** (calificación H,H, uno de los tres bloqueantes) describe un problema 
crítico de integración:

> "El Sistema de Información Hospitalaria (HIS) legacy soporta máximo **2 peticiones por 
> segundo**. En una noche de viernes con múltiples accidentes de tránsito simultáneos, 
> si VitalSync intenta enviar los reportes de 10 ambulancias simultáneamente, el servidor 
> hospitalario colapsa por completo, rechazando todas las conexiones."

El HIS es un sistema antiguo del hospital que no podemos modificar. **VitalSync debe 
adaptarse al límite del HIS, no al revés.**

## Decisión

Implementar un **patrón Productor-Consumidor con cola intermedia** en Firestore:

1. **Productor**: cuando un paciente está listo para entregarse al HIS, el backend agrega 
   un documento a la colección `/cola_his` con estado `PENDIENTE`.

2. **Consumidor (Worker)**: una Cloud Function programada que se ejecuta cada 1 minuto:
   - Lee máximo **2 documentos PENDIENTES** por ciclo
   - Los envía secuencialmente al HIS con **espera de 500ms entre cada uno** (= 2 req/s exactos)
   - Marca como `ENVIADO` o `FALLIDO` según respuesta

3. **Garantía de orden**: documentos procesados por `timestampCreacion ASC` (FIFO).

## Alternativas consideradas

### A. Envío directo al HIS desde el endpoint de registro
- **Contra:** En picos de carga, múltiples envíos paralelos colapsan al HIS
- **Razón de descarte:** Viola el rate limit del HIS

### B. Cloud Tasks (servicio dedicado de colas de Google)
- **Pro:** Servicio especializado, retry automático
- **Contra:** Free Tier de Cloud Tasks es limitado (1 millón ops/mes pero requiere 
  configuración adicional)
- **Razón de descarte:** Firestore + Cloud Function programada cumple el mismo objetivo 
  con herramientas que ya usamos

### C. RabbitMQ / Kafka en una VM
- **Contra:** Requiere IaaS (prohibido por el CFO, ver ADR-001)
- **Razón de descarte:** Violación de restricción de costo

## Consecuencias

### Positivas
-  Cumple driver E06: nunca más de 2 req/s al HIS, 100% entregados
-  Backpressure natural: si el HIS está caído, los mensajes se acumulan en la cola sin 
  pérdida
-  Throttling permite picos de hasta 100 pacientes simultáneos sin colapsar al HIS
- Auditoría completa: cada documento de cola registra intentos, errores, timestamps
-  Reintentos automáticos en el siguiente ciclo del worker (combina con ADR-007)

### Negativas / Trade-offs
-  **Latencia variable**: un paciente puede tardar hasta 1 minuto en llegar al HIS 
  (acceptable porque el HIS no es real-time crítico, el dashboard sí)
-  Worker programado cada 1 minuto = procesa 2 pacientes/minuto = **120 pacientes/hora 
  máximo**, suficiente para el MVP
-  Si la cola crece > 1000 documentos pendientes, requiere aumentar frecuencia del worker

## Cálculo de throughput

Con el worker actual: **2 pacientes/minuto = 120/hora**. Con 50 ambulancias del MVP y 
~30 minutos por traslado, máximo ~100 pacientes/hora simultáneos posibles. **Capacidad 
adecuada con margen del 20%.**

Para escalar a 1000 ambulancias (driver E20), bastará con cambiar el cron a `every 1 
seconds` o procesar más documentos por ciclo.

## Referencias
- Driver E06: HIS soporta máximo 2 req/seg
- ADR-007: Retry policy para fallos del HIS
- Patrón: Producer-Consumer with Rate Limiting
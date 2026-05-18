# ADR-001: Uso de Firebase como BaaS Serverless

## Estado
✅ Aceptado — Día 1 del desarrollo

## Contexto

El proyecto VitalSync tiene tres restricciones simultáneas que limitan la elección 
de infraestructura:

1. **Costo cero durante el MVP** (driver E08): el CFO Mateo Vargas prohibió 
   explícitamente IaaS y bases de datos relacionales por hora.
2. **Escalabilidad a 1.000 ambulancias en 12 meses** (driver E20) sin rediseño arquitectónico.
3. **MVP funcional en 10 semanas** sin existir infraestructura previa.

Adicionalmente, se requiere actualización push en tiempo real (driver E02, latencia < 3s) 
y soporte para almacenamiento de datos médicos bajo Ley Estatutaria de Salud.

## Decisión

Usar **Firebase** como Backend-as-a-Service (BaaS) completo:
- **Cloud Functions** (Node.js 18) para lógica de negocio
- **Cloud Firestore** como base de datos NoSQL serverless
- **Firebase Authentication** para autenticación (post-MVP)
- **Firebase Hosting** para el dashboard web

## Alternativas consideradas

### A. AWS Lambda + DynamoDB + API Gateway
- **Pro:** Más control granular, ecosistema maduro
- **Contra:** DynamoDB no encaja en Free Tier para el volumen proyectado (100 msg/s con 
  1000 ambulancias). API Gateway requiere configuración adicional para WebSockets.
- **Razón de descarte:** Costo proyectado > $0 USD/mes desde mes 2

### B. Azure Functions + Cosmos DB
- **Pro:** Buena integración con servicios Microsoft
- **Contra:** Cosmos DB no tiene Free Tier permanente
- **Razón de descarte:** Mismo problema de costo que AWS

### C. Servidor propio (VPS + PostgreSQL + Node.js)
- **Contra:** Es IaaS por hora, explícitamente prohibido por el CFO
- **Razón de descarte:** Violación directa de restricción de negocio

## Consecuencias

### Positivas
- ✅ Costo del MVP = $0 USD/mes (cumple driver E08)
- ✅ Escalabilidad automática hasta 1.000 ambulancias sin cambios (driver E20)
- ✅ `onSnapshot` resuelve el driver E02 sin configurar WebSockets manualmente
- ✅ Encriptación AES-256 en reposo de fábrica (cumple driver E04 parcialmente)
- ✅ Despliegue en minutos, no semanas

### Negativas / Trade-offs
- ⚠️ **Vendor lock-in con Google:** migrar a otro proveedor requeriría reescribir 
  considerable parte del backend (mitigado por usar Node.js estándar en Functions)
- ⚠️ **Modelo NoSQL:** sin JOINs nativos, requiere desnormalización de datos
- ⚠️ **Cold starts** en Cloud Functions pueden agregar 1-2s de latencia en la primera 
  llamada (aceptable para el driver E02 que permite hasta 3s)

## Referencias
- Driver E08: Free Tier obligatorio
- Driver E20: Escalabilidad a 1000 ambulancias
- Driver E02: Latencia < 3 segundos
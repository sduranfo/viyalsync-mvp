# Diagrama de Contenedores (C2) — VitalSync

## Propósito

Hacer zoom dentro de la caja "VitalSync" del diagrama de Contexto y mostrar las 
**grandes piezas técnicas** que la componen. Cada "contenedor" es una aplicación 
independiente o almacén de datos.

## Diagrama

```mermaid
graph TB
    subgraph externo["🌐 Actores externos"]
        paramedico["👤 Paramédico"]
        medico["👤 Médico Coord."]
        cirujano["👤 Cirujano"]
        his["🖥️ HIS Legacy"]
        twilio["📱 Twilio"]
    end
    
    subgraph vitalsync["🏥 VitalSync (Firebase Cloud)"]
        appMovil["📱 App Móvil<br/><br/>React Native + Expo<br/>+ SQLite local<br/><br/>(Offline-First)"]
        
        dashboard["💻 Dashboard Web<br/><br/>React + Vite<br/><br/>(onSnapshot push)"]
        
        backend["⚙️ Backend<br/><br/>Cloud Functions<br/>(Node.js 18)"]
        
        firestore[("🗄️ Firestore<br/><br/>NoSQL<br/>4 colecciones")]
    end
    
    paramedico -->|HTTPS<br/>POST signos vitales| appMovil
    appMovil -->|HTTPS<br/>JSON| backend
    medico -->|HTTPS<br/>navegador| dashboard
    dashboard -.->|WebSocket<br/>onSnapshot| firestore
    backend -->|read/write| firestore
    backend -->|HTTPS POST<br/>throttled 2 req/s| his
    backend -->|HTTPS API| twilio
    twilio -.->|SMS| cirujano
    
    style appMovil fill:#fbbf24,stroke:#d97706,color:#000
    style dashboard fill:#60a5fa,stroke:#2563eb,color:#000
    style backend fill:#a78bfa,stroke:#7c3aed,color:#000
    style firestore fill:#34d399,stroke:#059669,color:#000
    style externo fill:#f3f4f6,stroke:#9ca3af
    style vitalsync fill:#dbeafe,stroke:#3b82f6
```

## Explicación

### Contenedores principales

#### 📱 App Móvil
- **Tecnología**: React Native + Expo
- **Almacenamiento local**: SQLite (cola `pacientes_locales`)
- **Responsabilidad**: capturar datos del paramédico, garantizar offline-first
- **Por qué Expo**: permite desarrollar con Hot Reload en tablet sin configurar 
  Android Studio nativo

#### 💻 Dashboard Web
- **Tecnología**: React + Vite
- **Comunicación**: WebSocket persistente con Firestore via `onSnapshot`
- **Responsabilidad**: mostrar pacientes entrantes en tiempo real (< 3s)
- **Por qué Vite**: arranca en <1s, build optimizado, futuro deploy en Firebase Hosting

#### ⚙️ Backend
- **Tecnología**: Cloud Functions (Node.js 18)
- **Modelo**: serverless, sin servidor dedicado
- **Responsabilidad**: validación, idempotencia, encolado HIS, alertas SMS
- **Por qué serverless**: costo $0 en Free Tier, escala automático

#### 🗄️ Firestore
- **Tecnología**: NoSQL serverless de Firebase
- **4 colecciones**: `pacientes`, `pacientes_pii`, `cola_his`, `alertas_sms`
- **Por qué Firestore**: push automático con onSnapshot, encriptación AES-256 de fábrica

### Patrones de comunicación

| Origen | Destino | Protocolo | Tipo |
|---|---|---|---|
| App Móvil → Backend | HTTPS POST | JSON | Request/Response |
| Dashboard → Firestore | WebSocket | onSnapshot | Push (suscripción) |
| Backend → HIS | HTTPS POST | JSON | Request/Response (throttled) |
| Backend → Twilio | HTTPS API | Twilio SDK | Request/Response |

### Decisiones de diseño relevantes

- **Backend único** que actúa como anti-corrupción layer entre la app y los sistemas 
  externos (HIS, Twilio)
- **Firestore es el único punto de verdad** de los datos médicos
- **El Dashboard nunca habla con el Backend directamente**: lee de Firestore vía push, 
  cero polling

## Referencias

- ADR-001: Firebase BaaS
- ADR-002: Offline-First con SQLite (justifica el bloque interno de la app móvil)
- ADR-006: onSnapshot push (justifica la línea Dashboard ↔ Firestore)
# Architecture Decision Records (ADRs) — VitalSync

Este directorio contiene los registros de las decisiones arquitectónicas tomadas durante 
el desarrollo del MVP de VitalSync. Cada ADR documenta una decisión específica, las 
alternativas evaluadas y las consecuencias de la elección.

## Formato

Cada ADR sigue la plantilla de Michael Nygard:
- **Contexto:** el problema y las fuerzas en juego
- **Decisión:** la opción seleccionada
- **Alternativas consideradas:** opciones descartadas y por qué
- **Consecuencias:** trade-offs aceptados

## Índice de ADRs

| # | Título | Driver(s) cumplido(s) | Estado |
|---|--------|----------------------|--------|
| [ADR-001](./ADR-001-firebase-baas.md) | Uso de Firebase como BaaS Serverless | E08, E20 | ✅ Aceptado |
| [ADR-002](./ADR-002-offline-first-sqlite.md) | Patrón Offline-First con SQLite local | E01, E14 | ✅ Aceptado |
| [ADR-003](./ADR-003-idempotencia-uuid.md) | Idempotencia mediante requestId UUID | E11, E12 | ✅ Aceptado |
| [ADR-004](./ADR-004-separacion-pii.md) | Separación de PII en colección dedicada | E05 | ✅ Aceptado |
| [ADR-005](./ADR-005-cola-throttling-his.md) | Cola con throttling para integración HIS Legacy | E06 | ✅ Aceptado |
| [ADR-006](./ADR-006-dashboard-push-onsnapshot.md) | Dashboard en tiempo real con onSnapshot (push) | E02 | ✅ Aceptado |
| [ADR-007](./ADR-007-retry-backoff-exponencial.md) | Reintentos con backoff exponencial para HIS | E07 | ✅ Aceptado |
| [ADR-008](./ADR-008-validacion-cascada.md) | Validación en cascada (cliente + backend) | Calidad/Seguridad | ✅ Aceptado |

## Referencias

- Documento de Entrega 1: Drivers arquitectónicos y árbol de utilidad
- [Patrón ADR original — Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
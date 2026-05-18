# Diagramas Arquitectónicos — VitalSync

Esta carpeta contiene los diagramas que documentan visualmente la arquitectura del 
sistema VitalSync, complementando los ADRs (`../adr/`).

Los diagramas siguen el modelo **C4 de Simon Brown** (Context, Containers, Components, 
Code), más diagramas adicionales de despliegue y secuencia para flujos críticos.

## Índice de Diagramas

| # | Diagrama | Propósito |
|---|----------|-----------|
| [01](./01-contexto-c1.md) | **Contexto (C1)** | Sistema completo y sus actores externos |
| [02](./02-contenedores-c2.md) | **Contenedores (C2)** | Piezas técnicas que componen el sistema |
| [03](./03-componentes-c3.md) | **Componentes (C3)** | Detalle interno del backend |
| [04](./04-despliegue.md) | **Despliegue** | Mapa físico de qué corre en la nube |
| [05](./05-secuencia-triage-rojo.md) | **Secuencia** | Flujo crítico de un paciente Triage Rojo |

## Cómo visualizar

Los diagramas están escritos en **Mermaid**, un formato de texto que GitHub renderiza 
automáticamente. Basta con abrir cualquier archivo `.md` en GitHub o en VS Code (con 
extensión "Markdown Preview Mermaid Support") para verlos.
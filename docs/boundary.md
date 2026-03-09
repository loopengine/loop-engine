# OSS / Proprietary Boundary

This document defines what belongs in this repository and what belongs
in Better Data's proprietary platform.

## The Rule

> Does this code describe what a loop IS, or how a loop RUNS in production?

**IS -> this repo (OSS)**  
**RUNS in production -> Better Data's platform (proprietary)**

## OSS: what lives here

- Loop definition schema and DSL (what a loop looks like)
- Loop instance type model (what an executing loop is at a point in time)
- Event schema (what every transition emits)
- Actor model (who can act, with what evidence)
- Guard specification (what guards exist, declared)
- Signal detection primitives
- Observability schema (what metrics are tracked)
- Reference loop definitions (loops/ directory)
- Adapter interfaces (how to plug in a store or event bus)

## Proprietary: what does NOT live here

- Guard evaluation that calls Better Data hosted services
- AI optimization models (forecasting, demand prediction)
- Industry Packs (vertical-specific loop policy packs)
- Tenant isolation and multi-tenancy
- Billing metering
- Registry backend (the client is OSS; the server is proprietary)
- Better Data SCM module domain services

## How proprietary code uses this repo

Better Data's platform (bd-forge-main) imports `@loop-engine/*` as npm dependencies.
The proprietary loop-engine package uses `@loop-engine/core` types to define its
internal execution context. It never modifies or forks OSS types - it extends them.

## What a fork can and cannot do

A fork of this repo can:
- Build a complete Loop Engine runtime
- Implement any adapter
- Host their own registry
- Build AI optimization on top

A fork cannot:
- Use Better Data Industry Packs
- Access Better Data hosted registry without an API key
- Call themselves "Better Data" or use the Better Data brand

# OSS / Proprietary Boundary

This repository is the OSS Loop Engine implementation.

## One-sentence boundary rule

If it defines portable loop semantics/contracts, it belongs here; if it depends on
Better Data hosted tenant, billing, or proprietary intelligence systems, it does not.

## OSS packages in this repo

From `packages/`:

- `@loop-engine/core`
- `@loop-engine/dsl`
- `@loop-engine/runtime`
- `@loop-engine/events`
- `@loop-engine/actors`
- `@loop-engine/guards`
- `@loop-engine/signals`
- `@loop-engine/observability`
- `@loop-engine/sdk`
- `@loop-engine/registry-client`
- `@loop-engine/ui-devtools`
- `@loop-engine/adapter-memory`
- `@loop-engine/adapter-postgres`
- `@loop-engine/adapter-kafka`
- `@loop-engine/adapter-http`

## What belongs in OSS

- Core loop type system and schemas
- Runtime contracts (`LoopStore`, `EventBus`, `GuardEvaluator`)
- Domain-neutral actor/guard/event/signal primitives
- Reference loop definitions under `loops/`
- Portable adapters and registry clients

## What stays proprietary

- Multi-tenant and entitlement enforcement
- Hosted billing/metering and account controls
- Better Data-specific optimization models
- Better Data private registry backend behavior
- Product-specific business modules outside portable loop semantics

## Boundary checks used in this repo

Automated checks:

```bash
pnpm check-boundary
```

Helpful manual scans:

```bash
rg "@betterdata|@repo/" packages loops scripts
rg "procurement|inventory|shipment|lot" packages/core/src
```

## Quick reference: which package to use for what

| I want to... | Use |
|---|---|
| Define a loop type | `@loop-engine/dsl` |
| Run loops in my application | `@loop-engine/sdk` |
| Subscribe to loop events | `@loop-engine/events` |
| Add custom guard logic | `@loop-engine/guards` |
| Track who did what | `@loop-engine/actors` |
| Detect patterns in loop behavior | `@loop-engine/signals` |
| Build loop dashboards | `@loop-engine/observability` |
| Add React devtools | `@loop-engine/ui-devtools` |
| Persist loops to PostgreSQL | `@loop-engine/adapter-postgres` |

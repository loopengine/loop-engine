# LoopEngine

> Open-source execution library used by Boss Loops. Packages stay `@loop-engine/*`.

[![npm](https://img.shields.io/npm/v/@loop-engine/sdk.svg?label=@loop-engine/sdk)](https://www.npmjs.com/package/@loop-engine/sdk)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![docs](https://img.shields.io/badge/docs-bossloops.io-blue)](https://www.bossloops.io/docs/getting-started/boss-loops-and-loopengine)

## What is LoopEngine?

LoopEngine is the open-source execution library for governed decision loops. Boss Loops is the product and hosted platform built with this library. The product was originally introduced as LoopEngine. The library kept this name.

This repository is the library. It is not the hosted product at [app.bossloops.io](https://app.bossloops.io). Installing `@loop-engine/sdk` runs execution in your process. It does not issue an organization API key or apply hosted approver assignments.

LoopEngine connects providers, channels, and systems through decision loops.

Every transition through a loop:

- Names the actor responsible (human, automation, or AI agent)
- Evaluates guard policies before allowing the action
- Attaches structured evidence — what information the actor used
- Emits an immutable event with full attribution

This creates a decision record produced at runtime, not reconstructed afterward.

## What exists today

LoopEngine is the library you run in your environment — local-first, developer-operable, governance-native. Boss Loops Cloud is a separate hosted product.

| Capability | Status |
| --- | --- |
| Decision loop runtime (`@loop-engine/sdk`, `@loop-engine/runtime`) | Shipped |
| Guards, actors, events, signals (core primitives) | Shipped |
| Provider adapters (Anthropic, OpenAI, Gemini, Grok, Perplexity tool path) | Shipped |
| Persistence adapters (memory, Postgres, Kafka) | Shipped |
| Routing / human surfaces (OpenClaw, PagerDuty, Vercel AI SDK patterns) | Shipped |
| Observability timelines and replay | Shipped |

Install one SDK entrypoint, add adapters for your stack, define loops in YAML or TypeScript. Library and product docs live on **[bossloops.io/docs](https://www.bossloops.io/docs)**. `loopengine.io` redirects there. Package names remain `@loop-engine/*`.

## Why Loop Engine?

AI systems make recommendations. Humans approve on channels they already use. Enterprise systems execute side effects. Loop Engine governs what happens between them — who may transition, under which guards, with what evidence.

```text
Providers (intelligence)
   ↓
Decision loops + guards
   ↓
Channels (human surfaces)
   ↓
Integrations (enterprise systems)
   ↓
Evidence + learning
```

Loop Engine is **not** a workflow engine, Slack bot, or generic integration platform. It is governance substrate for AI-assisted operations.

**Workflows define the path. Loops govern the transitions.** Durable orchestrators (Temporal, n8n, application code) may execute approved work; Loop Engine decides whether state may change and records evidence first.

## Quick Start

```bash
npm install @loop-engine/sdk
```

```typescript
import { createLoopSystem, parseLoopYaml, GuardRegistry } from '@loop-engine/sdk'
import { MemoryStore } from '@loop-engine/adapter-memory'

const definition = parseLoopYaml(`
  loopId: expense.approval
  name: Expense Approval
  version: 1.0.0
  description: Human expense approval
  initialState: submitted
  states:
    - stateId: submitted
      label: Submitted
    - stateId: approved
      label: Approved
      terminal: true
    - stateId: rejected
      label: Rejected
      terminal: true
  transitions:
    - transitionId: approve
      from: submitted
      to: approved
      signal: approve
      allowedActors: [human]
    - transitionId: reject
      from: submitted
      to: rejected
      signal: reject
      allowedActors: [human]
`)

const guards = new GuardRegistry()
guards.registerBuiltIns()

const { engine } = await createLoopSystem({
  loops: [definition],
  store: new MemoryStore(),
  guards
})

const loop = await engine.start({
  loopId: definition.loopId,
  aggregateId: 'expense-4200' as never,
  actor: { id: 'alice', type: 'human' as const },
  metadata: { submittedBy: 'alice', amount: 4200 }
})

await engine.transition({
  aggregateId: loop.aggregateId,
  transitionId: 'approve' as never,
  actor: { id: 'bob', type: 'human' as const },
  evidence: { reviewNote: 'Within budget policy' }
})
```

## npm packages (implementation layer)

`@loop-engine/*` packages implement the runtime — start with [`@loop-engine/sdk`](packages/sdk). Adapters are optional by surface:

| Layer | Packages |
| --- | --- |
| Runtime core | `sdk`, `runtime`, `guards`, `actors`, `events`, `signals` |
| Providers | `adapter-anthropic`, `adapter-openai`, `adapter-gemini`, `adapter-grok`, `adapter-perplexity` |
| Channels / routing | `adapter-openclaw`, `adapter-vercel-ai`, `adapter-pagerduty` |
| Integrations | `adapter-postgres`, `adapter-kafka`, `adapter-http`, `adapter-commerce-gateway`, `adapter-memory` |

Contributor-only monorepo packages: `core`, `dsl`, and related internals bundled through `sdk` for app developers.

## Documentation

**Canonical documentation:** **[bossloops.io/docs](https://www.bossloops.io/docs)**. `loopengine.io` redirects there. This README is a GitHub entrypoint for the library, not the product story.

- [Boss Loops and LoopEngine](https://www.bossloops.io/docs/getting-started/boss-loops-and-loopengine)
- [Quick Start](https://www.bossloops.io/docs/getting-started/quick-start)
- [Architecture](https://www.bossloops.io/docs/getting-started/architecture)
- [Examples](https://www.bossloops.io/docs/examples)

## Boss Loops Cloud

This repository is LoopEngine, the library you run yourself.

Boss Loops Cloud is the hosted product at [app.bossloops.io](https://app.bossloops.io). Customers use an organization API key. The contract is the [Cloud API](https://www.bossloops.io/docs/cloud/api-reference). A library actor type is not a Cloud permission, and a Cloud connector is not automatically an npm adapter.

We do not claim feature parity between every library adapter and Cloud connector.

## Platform direction

Roadmap themes (not delivery commitments): expanded channel adapters and deeper hosted connector coverage. We avoid promising undelivered surfaces (for example multi-service compose stacks or a studio product). Direction is shared on the [changelog](https://www.bossloops.io/docs/changelog) and GitHub discussions.

## Examples

Reference walkthroughs on [bossloops.io/docs/examples](https://www.bossloops.io/docs/examples). The [loop-examples](https://github.com/loopengine/loop-examples) repository is being brought up to match current SDK APIs — verify runnable status before citing copy-paste flows.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). RFCs and discussions: [github.com/loopengine/loop-engine/discussions](https://github.com/loopengine/loop-engine/discussions).

## Provenance

- **Canonical repository:** https://github.com/loopengine/loop-engine
- **Maintainer:** Better Data, Inc. — https://betterdata.co
- **Documentation:** https://www.bossloops.io/docs
- **Issues:** https://github.com/loopengine/loop-engine/issues

## License

Apache-2.0 — see [LICENSE](LICENSE).

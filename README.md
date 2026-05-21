# Loop Engine

> An open governed operational runtime platform for AI-assisted enterprise systems.

[![npm](https://img.shields.io/npm/v/@loop-engine/sdk.svg?label=@loop-engine/sdk)](https://www.npmjs.com/package/@loop-engine/sdk)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![loopengine.io](https://img.shields.io/badge/docs-loopengine.io-blue)](https://loopengine.io)

## What is Loop Engine?

Loop Engine is an open governed operational runtime platform for AI-assisted enterprise systems.

Loop Engine connects AI providers, communication channels, and enterprise systems through decision loops.

Every transition through a loop:

- Names the actor responsible (human, automation, or AI agent)
- Evaluates guard policies before allowing the action
- Attaches structured evidence — what information the actor used
- Emits an immutable event with full attribution

This creates a decision record produced at runtime, not reconstructed afterward.

## What exists today

Loop Engine is an **OSS operational substrate** you run in your environment — local-first, developer-operable, governance-native.

| Capability | Status |
| --- | --- |
| Decision loop runtime (`@loop-engine/sdk`, `@loop-engine/runtime`) | Shipped |
| Guards, actors, events, signals (core primitives) | Shipped |
| Provider adapters (Anthropic, OpenAI, Gemini, Grok, Perplexity tool path) | Shipped |
| Persistence adapters (memory, Postgres, Kafka) | Shipped |
| Routing / human surfaces (OpenClaw, PagerDuty, Vercel AI SDK patterns) | Shipped |
| Observability timelines and replay | Shipped |

Install one SDK entrypoint, add adapters for your stack, define loops in YAML or TypeScript. Full taxonomy and guides live on **[loopengine.io](https://loopengine.io)** — the canonical documentation surface for this runtime.

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

**Canonical documentation:** **[loopengine.io/docs](https://loopengine.io/docs)** — runtime model, taxonomy, examples, and self-host paths. This repository README is a GitHub entrypoint; do not treat the package table above as the product story.

- [Quick Start](https://loopengine.io/docs/getting-started/quick-start)
- [Architecture](https://loopengine.io/docs/getting-started/architecture)
- [Integrations](https://loopengine.io/docs/integrations)
- [Examples](https://loopengine.io/docs/examples)

## Loop Engine Cloud (hosted boundary)

**Loop Engine** (this repo) is the open runtime you self-host.

**Loop Engine Cloud** is Better Data’s hosted governance control plane — multi-tenant runtime, connectors, and API keys at [loops.betterdata.co](https://loops.betterdata.co). Contract and operational details: [loopengine.io/docs/integrations/loop-engine-cloud-api](https://loopengine.io/docs/integrations/loop-engine-cloud-api).

We do not claim feature parity between every OSS adapter and Cloud connectors in this README; see hosted docs for what is available in your tenant.

## Platform direction

Roadmap themes (not delivery commitments): richer runtime taxonomy docs on loopengine.io, expanded channel adapters, and deeper hosted connector coverage. We avoid promising undelivered surfaces (e.g. multi-service compose stacks or studio products) in OSS copy — direction is shared on [loopengine.io/changelog](https://loopengine.io/docs/changelog) and GitHub discussions.

## Examples

Reference walkthroughs on [loopengine.io/docs/examples](https://loopengine.io/docs/examples). The [loop-examples](https://github.com/loopengine/loop-examples) repository is being brought up to match current SDK APIs — verify runnable status before citing copy-paste flows.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). RFCs and discussions: [github.com/loopengine/loop-engine/discussions](https://github.com/loopengine/loop-engine/discussions).

## Provenance

- **Canonical repository:** https://github.com/loopengine/loop-engine
- **Maintainer:** Better Data, Inc. — https://betterdata.co
- **Documentation:** https://loopengine.io
- **Issues:** https://github.com/loopengine/loop-engine/issues

## License

Apache-2.0 — see [LICENSE](LICENSE).

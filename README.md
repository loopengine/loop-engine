# Loop Engine

> Open runtime for governed, observable enterprise loops.

[![npm](https://img.shields.io/npm/v/@loop-engine/sdk.svg?label=@loop-engine/sdk)](https://www.npmjs.com/package/@loop-engine/sdk)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![loopengine.io](https://img.shields.io/badge/docs-loopengine.io-blue)](https://loopengine.io)

## What is Loop Engine?

Loop Engine is an open runtime for governing decisions made by AI agents, humans, and automations working together.

Every transition through a loop:
- Names the actor responsible (human, automation, or AI agent)
- Evaluates guard policies before allowing the action
- Attaches structured evidence - what information the actor used
- Emits an immutable event with full attribution

This creates a decision record produced at runtime, not reconstructed afterward.

## Why Loop Engine?

AI systems make recommendations. Humans approve decisions. Workflows execute actions. But who governed what happened in between?

Loop Engine sits between AI reasoning and operational execution. It enforces who can do what, under what conditions, with what evidence.

```text
AI Agent
   ↓
Loop Engine    ← decision governance
   ↓
Workflow / ERP / Infrastructure
```

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

## Packages

| Package | Description |
|---|---|
| [`@loop-engine/sdk`](packages/sdk) | Main SDK - start here |
| [`@loop-engine/runtime`](packages/runtime) | Loop lifecycle and transitions |
| [`@loop-engine/observability`](packages/observability) | Timeline and replay |
| [`@loop-engine/adapter-memory`](packages/adapter-memory) | In-memory storage |
| [`@loop-engine/adapter-postgres`](packages/adapters/postgres) | PostgreSQL storage |
| [`@loop-engine/adapter-kafka`](packages/adapters/kafka) | Kafka event streaming |
| [`@loop-engine/adapter-anthropic`](packages/adapter-anthropic) | Claude AI actor |
| [`@loop-engine/adapter-openai`](packages/adapter-openai) | OpenAI AI actor |
| [`@loop-engine/adapter-grok`](packages/adapter-grok) | Grok (xAI) AI actor |
| [`@loop-engine/adapter-gemini`](packages/adapter-gemini) | Gemini AI actor |
| [`@loop-engine/adapter-perplexity`](packages/adapter-perplexity) | Perplexity Sonar (`LLMAdapter`, citations) |
| [`@loop-engine/adapter-openclaw`](packages/adapter-openclaw) | OpenClaw integration |
| [`@loop-engine/adapter-commerce-gateway`](packages/adapter-commerce-gateway) | Commerce Gateway |
| [`@loop-engine/adapter-pagerduty`](packages/adapter-pagerduty) | PagerDuty incidents |
| [`@loop-engine/adapter-vercel-ai`](packages/adapter-vercel-ai) | Vercel AI SDK |

Core primitives are bundled in `@loop-engine/sdk`. Internal monorepo-only packages for contributors are:
`core`, `dsl`, `guards`, `actors`, `events`, and `signals`.

## Documentation

Full docs at **[loopengine.io](https://loopengine.io)**

- [Quick Start](https://loopengine.io/docs/getting-started/quick-start)
- [Core Concepts](https://loopengine.io/docs/core-concepts)
- [Examples](https://loopengine.io/docs/examples)
- [Integrations](https://loopengine.io/docs/integrations)
- [Perplexity Sonar & Computer (OSS)](docs/integrations-perplexity.md)

## Examples

Runnable examples in [github.com/loopengine/loop-examples](https://github.com/loopengine/loop-examples):

- Expense Approval - human-only approval gate
- AI Replenishment - Claude + OpenAI as governed actors
- Demand Signal - rule-based loop triggering
- Postgres Persistence - production storage adapter
- Event Streaming - Kafka event pipeline

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Open issues and RFCs at [github.com/loopengine/loop-engine/discussions](https://github.com/loopengine/loop-engine/discussions).

## Provenance and package trust

- **Canonical repository:** https://github.com/loopengine/loop-engine
- **Maintainer organization:** Better Data, Inc. (https://betterdata.co)
- **Package family:** `@loop-engine/*` packages in `packages/`
- **Issue tracker:** https://github.com/loopengine/loop-engine/issues
- **Documentation site:** https://loopengine.io

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.

Created and maintained by [Better Data](https://betterdata.co).

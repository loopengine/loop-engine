# Loop Engine

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache%202.0-2ea44f.svg)](./LICENSE)
[![npm org](https://img.shields.io/badge/npm-%40loop--engine-cb3837.svg)](https://www.npmjs.com/org/loop-engine)
[![CI](https://github.com/loopengine/loop-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/loopengine/loop-engine/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-loopengine.io-2563EB.svg)](https://loopengine.io)

> Open runtime for constrained, observable, and improvable enterprise loops.

Loop Engine helps teams model enterprise processes as finite-state control systems
operated by humans, automation, and AI.

Created by [Better Data](https://betterdata.co).

## What it is

The Loop Engine gives AI and automation structure, boundaries, and feedback - not
improvisation. Every process is a bounded state machine. Every action has an
attributed actor. Every completed loop emits structured training data.

- **Portable loop definitions** - define any process as a bounded state machine
- **Deterministic guards** - enforce policy before AI or automation can act
- **First-class actor model** - human, automation, and AI actions are all attributed
- **Structured events** - every transition emits training-quality data
- **Self-learning loops** - closed loops generate improvement signals automatically

## Quick start

```bash
npm install @loop-engine/sdk
```

```typescript
import { createLoopSystem } from "@loop-engine/sdk";
import { aggregateId } from "@loop-engine/core";
import type { LoopDefinition } from "@loop-engine/core";

const loop: LoopDefinition = { id: "finance.expense-approval", version: "1.0.0", domain: "finance", description: "Expense approval", states: [{ id: "OPEN" }, { id: "APPROVED", isTerminal: true }], initialState: "OPEN", transitions: [{ id: "approve", from: "OPEN", to: "APPROVED", allowedActors: ["human"] }], outcome: { id: "decision_recorded", description: "Expense decision recorded", valueUnit: "decision", measurable: true } };

const { engine } = await createLoopSystem({ loops: [loop] });
await engine.start({ loopId: "finance.expense-approval", aggregateId: aggregateId("EXP-001"), orgId: "acme", actor: { type: "human", id: "approver@acme.com" } });
```

Full getting-started docs: [loopengine.io/docs/getting-started/quick-start](https://loopengine.io/docs/getting-started/quick-start)

## Packages

| Package | Purpose |
|---------|---------|
| @loop-engine/core | Domain model types - zero dependencies |
| @loop-engine/dsl | YAML/JSON loop authoring, parsing, validation |
| @loop-engine/runtime | State machine executor |
| @loop-engine/guards | Deterministic policy checks |
| @loop-engine/signals | Event-to-signal detection |
| @loop-engine/events | Canonical event schema |
| @loop-engine/actors | Actor model + AI actor constraints |
| @loop-engine/observability | Loop history, timelines, metrics |
| @loop-engine/sdk | Friendly developer interface (start here) |
| @loop-engine/registry-client | Fetch loop definitions from a registry |
| @loop-engine/ui-devtools | React devtools panel |
| @loop-engine/adapter-memory | In-memory store (testing/dev) |
| @loop-engine/adapter-postgres | PostgreSQL persistence |
| @loop-engine/adapter-kafka | Kafka event bus |
| @loop-engine/adapter-http | HTTP webhook event bus |
| @loop-engine/adapter-openclaw | OpenClaw messaging gateway adapter |
| @loop-engine/adapter-commerce-gateway | Commerce Gateway integration for governed AI workflows |

npm organization: [npmjs.com/org/loop-engine](https://www.npmjs.com/org/loop-engine)

## Examples

See [examples/mini](./examples/mini) for lightweight runnable examples.
For complete reference implementations, see [loop-examples](https://github.com/loopengine/loop-examples).

## Documentation

[loopengine.io](https://loopengine.io)

## Contributing

- Read [CONTRIBUTING.md](./CONTRIBUTING.md)
- RFC process: [loopengine.io/docs/governance/rfc-process](https://loopengine.io/docs/governance/rfc-process)

## License

Loop Engine is licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for details.

## Trademarks

Loop Engine is a trademark of Better Data Inc. The Apache License 2.0 applies to the source code in this repository and does not grant rights to use Better Data's trademarks, service marks, or product names except as permitted by applicable law.

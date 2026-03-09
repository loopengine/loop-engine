# Loop Engine

Loop Engine is an open-source runtime for constrained, observable, and improvable
operational loops.

It helps teams model enterprise processes as finite-state control systems that can
be operated by humans, automation, and AI.

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
npm install @loopengine/sdk
```

```typescript
import { createLoopEngine } from "@loopengine/sdk";

const engine = createLoopEngine({ store: memoryStore() });

await engine.start({
  loopId: "scm.procurement",
  aggregateId: "PO-2026-0012"
});

await engine.transition({
  aggregateId: "PO-2026-0012",
  transitionId: "confirm_po",
  actor: { type: "human", id: "drew.kim@example.com" },
  evidence: { approved: true, method: "3-way-match" }
});
```

## Packages

| Package | Purpose |
|---------|---------|
| @loopengine/core | Domain model types - zero dependencies |
| @loopengine/dsl | YAML/JSON loop authoring, parsing, validation |
| @loopengine/runtime | State machine executor |
| @loopengine/guards | Deterministic policy checks |
| @loopengine/signals | Event-to-signal detection |
| @loopengine/events | Canonical event schema |
| @loopengine/actors | Actor model + AI actor constraints |
| @loopengine/observability | Loop history, timelines, metrics |
| @loopengine/sdk | Friendly developer interface (start here) |
| @loopengine/registry-client | Fetch loop definitions from a registry |
| @loopengine/ui-devtools | React devtools panel |
| @loopengine/adapter-memory | In-memory store (testing/dev) |
| @loopengine/adapter-postgres | PostgreSQL persistence |
| @loopengine/adapter-kafka | Kafka event bus |

## Examples

See [examples/mini](./examples/mini) for lightweight runnable examples.
For complete reference implementations, see [loop-examples](https://github.com/loopengine/loop-examples).

## Documentation

[loopengine.dev](https://loopengine.dev)

## License

MIT

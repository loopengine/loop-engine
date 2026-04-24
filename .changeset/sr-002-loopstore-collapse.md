---
"@loop-engine/core": major
"@loop-engine/runtime": major
"@loop-engine/sdk": major
"@loop-engine/actors": major
"@loop-engine/guards": major
"@loop-engine/loop-definition": major
"@loop-engine/events": major
"@loop-engine/signals": major
"@loop-engine/observability": major
"@loop-engine/registry-client": major
"@loop-engine/ui-devtools": major
"@loop-engine/adapter-memory": major
"@loop-engine/adapter-vercel-ai": major
"@loop-engine/adapter-perplexity": major
"@loop-engine/adapter-anthropic": major
"@loop-engine/adapter-openai": major
"@loop-engine/adapter-gemini": major
"@loop-engine/adapter-grok": major
"@loop-engine/adapter-http": major
"@loop-engine/adapter-openclaw": major
"@loop-engine/adapter-pagerduty": major
"@loop-engine/adapter-commerce-gateway": major
---
## SR-002 · D-11 · LoopStore collapse and rename

**Interface rename + structural collapse (6 methods → 5):**

- runtime interface `LoopStorageAdapter` → `LoopStore`
- adapter class `MemoryLoopStorageAdapter` → `MemoryStore`
- adapter factory `createMemoryLoopStorageAdapter` → `memoryStore`
- adapter factory `postgresStorageAdapter` removed (consolidated into
  the canonical `postgresStore`)
- SDK option key `storage` → `store` (both `CreateLoopSystemOptions`
  and the `createLoopSystem` return shape)

**Method renames + collapse:**

| Before | After | Operation |
|---|---|---|
| `getLoop` | `getInstance` | rename |
| `createLoop` | `saveInstance` | collapse with `updateLoop` |
| `updateLoop` | `saveInstance` | collapse with `createLoop` |
| `appendTransition` | `saveTransitionRecord` | rename |
| `getTransitions` | `getTransitionHistory` | rename |
| `listOpenLoops` | `listOpenInstances` | rename |

`createLoop` + `updateLoop` collapse into a single `saveInstance` method
with upsert semantics. The `MemoryStore` adapter implements this as a
single `Map.set`. The `postgresStore` adapter implements it as
`INSERT ... ON CONFLICT (aggregate_id) DO UPDATE SET ...`.

**Migration:**

```diff
- import { MemoryLoopStorageAdapter, createMemoryLoopStorageAdapter } from "@loop-engine/adapter-memory";
+ import { MemoryStore, memoryStore } from "@loop-engine/adapter-memory";

- import type { LoopStorageAdapter } from "@loop-engine/runtime";
+ import type { LoopStore } from "@loop-engine/runtime";

- const adapter = createMemoryLoopStorageAdapter();
+ const store = memoryStore();

- await createLoopSystem({ loops, storage: adapter });
+ await createLoopSystem({ loops, store });

- const { engine, storage } = await createLoopSystem({...});
+ const { engine, store } = await createLoopSystem({...});

- await storage.getLoop(aggregateId);
+ await store.getInstance(aggregateId);

- await storage.createLoop(instance);  // or updateLoop
+ await store.saveInstance(instance);

- await storage.appendTransition(record);
+ await store.saveTransitionRecord(record);

- await storage.getTransitions(aggregateId);
+ await store.getTransitionHistory(aggregateId);

- await storage.listOpenLoops(loopId);
+ await store.listOpenInstances(loopId);
```

Custom adapters that implement the interface must update method names
and collapse `createLoop` + `updateLoop` into a single `saveInstance`
upsert. There is no aliasing; all consumers must migrate.

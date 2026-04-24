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
## SR-001 · D-07 · Engine class & method naming

**Renames (no aliases, no dual names):**

- runtime class `LoopSystem` → `LoopEngine`
- runtime factory `createLoopSystem` → `createLoopEngine`
- runtime options `LoopSystemOptions` → `LoopEngineOptions`
- engine method `startLoop` → `start`
- engine method `getLoop` → `getState`

**Intentionally preserved (not breaking):**

- SDK aggregate factory `createLoopSystem` keeps its name (this is the
  intentional product name for the auto-wired aggregate, not an alias
  to the runtime — the runtime factory is `createLoopEngine`).
- `LoopStorageAdapter.getLoop` (D-11 territory; lands in SR-002).

**Migration:**

```diff
- import { LoopSystem, createLoopSystem } from "@loop-engine/runtime";
+ import { LoopEngine, createLoopEngine } from "@loop-engine/runtime";

- const system: LoopSystem = createLoopSystem({...});
+ const engine: LoopEngine = createLoopEngine({...});

- await system.startLoop({...});
+ await engine.start({...});

- await system.getLoop(aggregateId);
+ await engine.getState(aggregateId);
```

SDK consumers do **not** need to change `createLoopSystem` from
`@loop-engine/sdk`; that name is preserved. SDK consumers do need to
update the engine method call shape if they reach into the returned
`engine` object: `system.engine.startLoop(...)` becomes
`system.engine.start(...)`.

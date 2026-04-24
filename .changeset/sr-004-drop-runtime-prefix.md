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
## SR-004 · MECHANICAL 8.5 · Drop `Runtime` prefix from primitive types

**Renames + relocation (no aliases, no dual names):**

- runtime interface `RuntimeLoopInstance` → `LoopInstance`
- runtime interface `RuntimeTransitionRecord` → `TransitionRecord`
- both interfaces relocate from `@loop-engine/runtime` to
  `@loop-engine/core` (new file `packages/core/src/loopInstance.ts`)
  so they appear on the core public surface

**Attribution:** sanctioned by `MECHANICAL 8.5`; implied by D-07's
"no dual names anywhere" clause and the spec draft's use of the
post-rename names. Not enumerated explicitly in D-07's resolution
log text (per F-PB-04).

**Surface diff:**

| Package | Before | After |
|---|---|---|
| `@loop-engine/core` | — | exports `LoopInstance`, `TransitionRecord` |
| `@loop-engine/runtime` | exports `RuntimeLoopInstance`, `RuntimeTransitionRecord` | removed |
| `@loop-engine/sdk` | re-exports `Runtime*` from `@loop-engine/runtime` | re-exports new names from `@loop-engine/core` via existing `export *` barrel |

**Internal referrers updated** (import path migrates from
`@loop-engine/runtime` to `@loop-engine/core` for the type-only
imports):

- `@loop-engine/runtime` (engine.ts + interfaces.ts + engine.test.ts)
- `@loop-engine/observability` (timeline.ts, replay.ts, metrics.ts +
  observability.test.ts)
- `@loop-engine/adapter-memory`
- `@loop-engine/adapter-postgres`
- `@loop-engine/sdk` (drops explicit `RuntimeLoopInstance` /
  `RuntimeTransitionRecord` re-export; new names propagate via
  the existing `export * from "@loop-engine/core"`)

**Migration:**

```diff
- import type { RuntimeLoopInstance, RuntimeTransitionRecord } from "@loop-engine/runtime";
+ import type { LoopInstance, TransitionRecord } from "@loop-engine/core";

- function process(instance: RuntimeLoopInstance, history: RuntimeTransitionRecord[]): void { ... }
+ function process(instance: LoopInstance, history: TransitionRecord[]): void { ... }
```

SDK consumers reading from `@loop-engine/sdk` can either keep that
import path (the new names propagate via the barrel) or migrate
directly to `@loop-engine/core`.

`LoopStore` and other interfaces using these types kept their
parameter and return types in lockstep — no runtime behavior change.

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
## SR-012 · D-01 · ID factory functions

**Class.** Class 1 (additive — seven new factory functions in `@loop-engine/core`; no signature changes elsewhere, no relocations, no removals).

**Scope.** `packages/core/src/idFactories.ts` is a new file containing seven brand-cast factory functions, one per `1.0.0-rc.0` ID brand: `loopId`, `aggregateId`, `transitionId`, `guardId`, `signalId`, `stateId`, `actorId`. Each is a pure type-level cast `(s: string) => XId`; no runtime validation. The barrel (`packages/core/src/index.ts`) re-exports the new file via `export * from "./idFactories"`. Tests landed at `packages/core/src/__tests__/idFactories.test.ts` (8 tests covering runtime identity for each factory plus a type-level lock-in test).

**Why factories rather than inline casts.** Branded types (`LoopId`, `AggregateId`, `ActorId`, `SignalId`, `GuardId`, `StateId`, `TransitionId`) are zero-cost type-level brands; constructing one requires casting from `string`. Without factories, every consumer call site repeats `someValue as LoopId` — readable in isolation but noisy across test fixtures, examples, and migration code. Factories give consumers a named function per brand so intent is explicit at the call site (`loopId("support.ticket")` reads as a constructor; `"support.ticket" as LoopId` reads as a workaround).

**Out of scope per D-01 → A.** Per the resolution log, D-01 enumerates exactly seven factories. The two newer brand schemas added in SR-009 (`OutcomeIdSchema` / `CorrelationIdSchema`) intentionally do **not** get matching factories in this SR — `outcomeId` / `correlationId` are deferred until SDK consumer experience surfaces a need. No runtime-validating factories (`loopIdSafe(s) → { ok, id } | { ok: false, error }`) — consumers needing format validation use the corresponding `*Schema.parse()` directly.

**Migration.**

```diff
  // Before — inline casts at every call site:
- import type { LoopId } from "@loop-engine/core";
- const id: LoopId = "support.ticket" as LoopId;

  // After — named factory:
+ import { loopId } from "@loop-engine/core";
+ const id = loopId("support.ticket");
```

Existing inline casts continue to work — SR-012 is purely additive, nothing is removed. Adopt the factories at the migrator's pace.

**Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean (pre + post build); workspace `pnpm -r typecheck` green; workspace `pnpm -r test` green (15/15 tests pass in `@loop-engine/core` — 7 prior + 8 new; full workspace test count unchanged elsewhere); d.ts surface diff confirms all seven `declare const *Id: (s: string) => XId` exports are present in `packages/core/dist/index.d.ts`. Tarball size for `@loop-engine/core`: 18.7 KB packed / 106.5 KB unpacked — well under the 500 KB ceiling per the product rule for core.

**Symbol diff against 0.1.5.**

Added to `@loop-engine/core` public surface:
- `const loopId: (s: string) => LoopId`
- `const aggregateId: (s: string) => AggregateId`
- `const transitionId: (s: string) => TransitionId`
- `const guardId: (s: string) => GuardId`
- `const signalId: (s: string) => SignalId`
- `const stateId: (s: string) => StateId`
- `const actorId: (s: string) => ActorId`

No changes to any other package; propagates transparently through the SDK barrel via the existing `export * from "@loop-engine/core"` re-export.

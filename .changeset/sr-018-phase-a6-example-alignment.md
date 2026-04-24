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
## SR-018 · F-PB-09 + D-01 + D-05 + D-07 + D-13 · Phase A.6 example-tree alignment

**Packages bumped:** none. SR-018 is consumer-side alignment only — no published package surface changes.

**Status.** Closed. **Phase A.6 closes** with this SR (single-commit cascade per operator's purely-mechanical lean).

**Class.** Class 0 (internal / non-shipping). `examples/ai-actors/shared/**/*.ts` is not packaged; the alignment is verification-scope hygiene plus one structural fix to the `typecheck:examples` include scope.

**Rationale.** Phase A.6 aligns the in-tree `[le]` examples with the post-reconciliation surface so that every symbol referenced by the examples is the one that actually ships at `1.0.0-rc.0`. Four pre-reconciliation idioms were still present in the `ai-actors/shared` files because the `tsconfig.examples.json` include list only covered `loop.ts` — the other four files (`actors.ts`, `assertions.ts`, `scenario.ts`, `types.ts`) were invisible to the `typecheck:examples` gate. Widening the include surfaced three compile errors and prompted cleanup of one additional latent field (`ReplenishmentContext.orgId` per F-PB-09 / D-06).

**F-PA6-01 (substantive, structural, resolved in-SR).** `tsconfig.examples.json` included only one of five files in `ai-actors/shared/`. Consequence: `buildActorEvidence` (renamed to `buildAIActorEvidence` in D-13 cascade), the legacy `AIAgentActor.agentId`/`.gatewaySessionId` fields (replaced by `.modelId`/`.provider` in SR-006 / D-13), and the plain-string actor-id literal (should be `actorId(...)` factory per D-01 / SR-012) all survived as pre-reconciliation drift without a compile signal. This is the Phase A.6 analog of SR-016's latent-bug findings — insufficient verification coverage masks accumulating drift. Resolution: widened the include to `examples/ai-actors/shared/**/*.ts` and fixed the three compile errors that then surfaced. No runtime bugs existed because the shared module is library-shaped (no entry point exercises it yet; the `examples/mini/*/` dirs are empty placeholders pending Branch C authoring).

**On F-PB-09 `Tenant` cleanup.** The prompt flagged "`Tenant` interface carrying `orgId` at `examples/ai-actors/shared/types.ts:21`" for removal. Actual state: there was no `Tenant` type. The `orgId` field lived on `ReplenishmentContext`, a scenario-shape carrier for the demand-replenishment example. Path taken: surgical field removal from `ReplenishmentContext` (no new type introduced; no type removed — `ReplenishmentContext` is still the meaningful carrier for the example's scenario state, just without the tenant-scoping field). This matches the operator's guidance ("the orgId field removal should not introduce a new Tenant type, just remove the field").

**Changes by file.**

- `examples/ai-actors/shared/types.ts`
  - Removed `orgId: string` from `ReplenishmentContext` (F-PB-09 / D-06).
  - Changed `loopAggregateId: string` to `loopAggregateId: AggregateId` (brand the field to demonstrate D-01 / SR-012 post-reconciliation idiom at the scenario-carrier level).
  - Added `import type { AggregateId } from "@loop-engine/core"`.

- `examples/ai-actors/shared/scenario.ts`
  - Removed `orgId: "lumebonde"` line from `REPLENISHMENT_CONTEXT`.
  - Wrapped the aggregate-id literal in the `aggregateId(...)` factory (D-01 / SR-012).
  - Added `import { aggregateId } from "@loop-engine/core"`.

- `examples/ai-actors/shared/actors.ts`
  - Changed import from `buildActorEvidence` (pre-reconciliation name, no longer exported) to `buildAIActorEvidence` (D-13 cascade, post-SR-013b).
  - Added `actorId` factory import; wrapped `"agent:demand-forecaster"` literal with the factory (D-01).
  - Changed `buildForecastingActor(agentId: string, gatewaySessionId: string)` → `buildForecastingActor(provider: string, modelId: string)` to match the current `AIAgentActor` shape (post-SR-006 / D-13: `{ type, id, provider, modelId, confidence?, promptHash?, toolsUsed? }` — no `agentId` or `gatewaySessionId` fields).
  - Updated `buildRecommendationEvidence` to pass `{ provider, modelId, reasoning, confidence, dataPoints }` matching `buildAIActorEvidence`'s current signature.

- `examples/ai-actors/shared/assertions.ts`
  - Changed helper signatures from `aggregateId: string` to `aggregateId: AggregateId` (branded; D-01) and dropped the `as never` escape-hatch casts at the `engine.getState(...)` and `engine.getHistory(...)` call sites.
  - Changed AI-transition display from `aiTransition.actor.agentId` (non-existent field) to reading `modelId` and `provider` from the transition's evidence record (which is where `buildAIActorEvidence` places them, per SR-006 / D-13).
  - Adjusted evidence key references (`ai_confidence` → `confidence`, `ai_reasoning` → `reasoning`) to match `AIAgentSubmission["evidence"]`'s current keys (per SR-006).

- `tsconfig.examples.json`
  - Widened `include` from `["examples/ai-actors/shared/loop.ts"]` to `["examples/ai-actors/shared/**/*.ts"]` so the `typecheck:examples` gate covers all five shared files (structural fix for F-PA6-01).

**Decisions referenced (all post-reconciliation names now used exclusively in the `[le]` tree):**

- D-01 (ID factories): `aggregateId(...)`, `actorId(...)` used at scenario and actor-construction sites.
- D-05 (schema field renames): no direct consumer changes — the `LoopBuilder` chain in `loop.ts` was already D-05-conformant (uses `id` on transitions/outcomes, not `transitionId`/`outcomeId` — verified via `tsconfig.examples.json`'s prior include, which caught the one file that had been updated during SR-010/SR-011).
- D-07 (`LoopEngine`, `start`, `getState`): `assertions.ts` uses these names already; no rename needed. The cleanup was dropping the `as never` branded-id casts.
- D-11 (`LoopStore`, `saveInstance`): no consumer in the shared module; the `ai-actors/shared` tree does not construct a store.
- D-13 (`ActorAdapter`, `AIAgentSubmission`, provider re-homings): `actors.ts` updated to the post-D-13 `AIAgentActor` shape and to `buildAIActorEvidence`'s current signature.

**Out of scope for this row (intentionally):**

- `[lx]` row (`/Projects/loop-examples/`) — separate repository; executed in Branch C per the reconciled prompt.
- `examples/mini/*/` directories — currently `.gitkeep` placeholders (no content to align). Populating them with working example code is Branch C authoring work.
- Runtime exercise of the example shared module. No entry point currently imports it; a smoke-run from a `mini/*` example or from a Branch C consumer would catch any runtime-only drift. None is suspected — all current references are either library-shaped (type signatures, pure functions) or behind a consumer that doesn't yet exist.

**Verification.**

- `pnpm typecheck:examples` → exit 0. All five files in `ai-actors/shared/` now in scope and compile clean under `strict: true`.
- C-14 full-stream failure scan on `pnpm typecheck:examples` → clean (only pre-existing `NODE_AUTH_TOKEN` `.npmrc` warnings, which are environmental and not produced by the typecheck itself).
- `tsc --listFiles` confirms all five shared files participate in the compile (previously only `loop.ts`).

**Originator.** F-PB-09 (orgId cleanup), D-01/D-05/D-07/D-11/D-13 (post-reconciliation-names-exclusively constraint). Pre-scoped and adjudicated at Phase A.6 clearance.

**Phase A.6 closure.** SR-018 closes Phase A.6. Phase A.7 (end-of-Branch-A verification pass) opens next, running the full gate per the reconciled prompt's §Phase A.7 scope.

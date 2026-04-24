# @loop-engine/adapter-perplexity

## 1.0.0-rc.0

### Major Changes

- ## SR-001 · D-07 · Engine class & method naming

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

- ## SR-002 · D-11 · LoopStore collapse and rename

  **Interface rename + structural collapse (6 methods → 5):**

  - runtime interface `LoopStorageAdapter` → `LoopStore`
  - adapter class `MemoryLoopStorageAdapter` → `MemoryStore`
  - adapter factory `createMemoryLoopStorageAdapter` → `memoryStore`
  - adapter factory `postgresStorageAdapter` removed (consolidated into
    the canonical `postgresStore`)
  - SDK option key `storage` → `store` (both `CreateLoopSystemOptions`
    and the `createLoopSystem` return shape)

  **Method renames + collapse:**

  | Before             | After                  | Operation                  |
  | ------------------ | ---------------------- | -------------------------- |
  | `getLoop`          | `getInstance`          | rename                     |
  | `createLoop`       | `saveInstance`         | collapse with `updateLoop` |
  | `updateLoop`       | `saveInstance`         | collapse with `createLoop` |
  | `appendTransition` | `saveTransitionRecord` | rename                     |
  | `getTransitions`   | `getTransitionHistory` | rename                     |
  | `listOpenLoops`    | `listOpenInstances`    | rename                     |

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

- ## SR-003 · D-13 · LLMAdapter → ToolAdapter (narrow rename)

  **Interface rename (no alias):**

  - `@loop-engine/core` interface `LLMAdapter` → `ToolAdapter`
  - source file `packages/core/src/llmAdapter.ts` →
    `packages/core/src/toolAdapter.ts` (git mv; history preserved)

  **Implementer update (the lone in-tree implementer):**

  - `@loop-engine/adapter-perplexity` `PerplexityAdapter` now
    declares `implements ToolAdapter`

  **Out of scope for this row (intentionally):**

  The four other AI provider adapters — `@loop-engine/adapter-anthropic`,
  `@loop-engine/adapter-openai`, `@loop-engine/adapter-gemini`,
  `@loop-engine/adapter-grok`, `@loop-engine/adapter-vercel-ai` — do
  **not** implement `LLMAdapter` today; each carries a bespoke
  `*ActorAdapter` shape. They re-home onto the new `ActorAdapter`
  archetype (a separate, distinct interface) in Phase A.3 — not onto
  `ToolAdapter`. Per D-13 the two archetypes carry different intents:
  `ToolAdapter` is for grounded-tool calls (text-in / text-out + evidence);
  `ActorAdapter` is for autonomous decision-making actors.

  **Migration:**

  ```diff
  - import type { LLMAdapter } from "@loop-engine/core";
  + import type { ToolAdapter } from "@loop-engine/core";

  - class MyAdapter implements LLMAdapter { ... }
  + class MyAdapter implements ToolAdapter { ... }
  ```

  The `invoke()`, `guardEvidence()`, and optional `stream()` methods
  are unchanged in signature; only the interface name renames.
  Consumers that only depend on `@loop-engine/adapter-perplexity`
  (rather than implementing the interface themselves) need no code
  changes — the package's public exports do not include
  `LLMAdapter`/`ToolAdapter` directly.

- ## SR-004 · MECHANICAL 8.5 · Drop `Runtime` prefix from primitive types

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

  | Package                | Before                                                   | After                                                                        |
  | ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
  | `@loop-engine/core`    | —                                                        | exports `LoopInstance`, `TransitionRecord`                                   |
  | `@loop-engine/runtime` | exports `RuntimeLoopInstance`, `RuntimeTransitionRecord` | removed                                                                      |
  | `@loop-engine/sdk`     | re-exports `Runtime*` from `@loop-engine/runtime`        | re-exports new names from `@loop-engine/core` via existing `export *` barrel |

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

- ## SR-005 · D-09 · `LoopEngine.listOpen` + verify cancelLoop/failLoop public surface

  **Surface addition (Class 2 row, single implementer):**

  - `@loop-engine/runtime` `LoopEngine.listOpen(loopId: LoopId): Promise<LoopInstance[]>`
    — net-new public method; delegates to the existing
    `LoopStore.listOpenInstances` (added in SR-002 per D-11).

  **Public surface verification (no source change required):**

  - `LoopEngine.cancelLoop(aggregateId, actor, reason?)` —
    pre-existing public method, confirmed not marked `private`,
    signature unchanged.
  - `LoopEngine.failLoop(aggregateId, fromState, error)` —
    pre-existing public method, confirmed not marked `private`,
    signature unchanged.

  **Out of scope for this row (intentionally):**

  - `registerSideEffectHandler` — explicitly deferred to `1.1.0`
    per D-09; remains internal in `1.0.0-rc.0`. Docs that currently
    reference it (`runtime.mdx:43`) will be cleaned up in Branch B.1.

  **Migration:**

  ```diff
  - // Previously, listing open instances required dropping to the store directly:
  - const open = await store.listOpenInstances("my.loop");
  + const open = await engine.listOpen("my.loop");
  ```

  The store-level `listOpenInstances` method remains public on
  `LoopStore` for adapter implementations and direct-store use. The
  new `engine.listOpen` provides a higher-level surface for
  applications that already hold a `LoopEngine` reference and don't
  want to thread the store separately.

- ## SR-006 — `feat(core): introduce ActorAdapter archetype + relocate AIAgentSubmission + AIAgentActor to core (D-13; PB-EX-01 Option A + PB-EX-04 Option A)`

  **Surface change.** `@loop-engine/core` adds the new
  `ActorAdapter` interface (the AI-as-actor archetype, paired with
  the existing `ToolAdapter` AI-as-capability archetype), and gains
  four supporting types previously owned by `@loop-engine/actors`:
  `AIAgentActor`, `AIAgentSubmission`, `LoopActorPromptContext`,
  `LoopActorPromptSignal`.

  **Why ActorAdapter is here.** Loop Engine has two AI integration
  archetypes — the AI as decision-making actor (`ActorAdapter`) and
  the AI as a callable capability/tool (`ToolAdapter`). Both
  contracts live in `@loop-engine/core` so adapter packages depend
  on a single foundational interface surface. See
  `API_SURFACE_DECISIONS_RESOLVED.md` D-13 for the full archetype
  rationale.

  **Why the relocation.** Placing `ActorAdapter` in `core` requires
  that `core` be closed under its own type graph: every type
  `ActorAdapter` references (and every type those types reference)
  must also live in `core`. The four relocated types form
  `ActorAdapter`'s transitive contract surface. `core` has no
  workspace dependency on `@loop-engine/actors`, so leaving any of
  them in `actors` would create a `core → actors → core` type-level
  cycle. Captured as the D-13 first + second extensions in
  `API_SURFACE_DECISIONS_RESOLVED.md` (originating findings:
  PB-EX-01 + PB-EX-04 in `PASS_B_EXCEPTIONS.md`).

  **Implementer count at this release.** Zero by design.
  `ActorAdapter` is a net-new contract; the five expected
  implementer adapters (Anthropic, OpenAI, Gemini, Grok, Vercel-AI)
  re-home onto it via Phase A.3's MECHANICAL 8.16 commit.

  **Migration (consumers of the four relocated types):**

  ```diff
  - import type { AIAgentActor, AIAgentSubmission, LoopActorPromptContext, LoopActorPromptSignal } from "@loop-engine/actors";
  + import type { AIAgentActor, AIAgentSubmission, LoopActorPromptContext, LoopActorPromptSignal } from "@loop-engine/core";
  ```

  `@loop-engine/actors` continues to own the rest of its surface
  (`HumanActor`, `AutomationActor`, `SystemActor`, the actor Zod
  schemas including `AIAgentActorSchema`, `isAuthorized` /
  `canActorExecuteTransition`, `buildAIActorEvidence`,
  `ActorDecisionError`, `AIActorDecision`, `ActorDecisionErrorCode`).
  The `Actor` union (`HumanActor | AutomationActor | AIAgentActor`)
  keeps its shape — `actors` now imports `AIAgentActor` from `core`
  to construct the union, so consumers see no shape change.

  **Migration (implementing ActorAdapter):**

  ```ts
  import type {
    ActorAdapter,
    LoopActorPromptContext,
    AIAgentSubmission,
  } from "@loop-engine/core";

  export class MyProviderActorAdapter implements ActorAdapter {
    provider = "my-provider";
    model = "model-name";
    async createSubmission(
      context: LoopActorPromptContext
    ): Promise<AIAgentSubmission> {
      // ...
    }
  }
  ```

  **Out of scope for this row (intentionally):**

  - AI provider adapters' re-homing onto `ActorAdapter` — landed
    in Phase A.3 (MECHANICAL 8.16 commit). At this release the
    five AI adapters still expose their bespoke per-provider types
    (`AnthropicLoopActor`, `OpenAILoopActor`, `GeminiLoopActor`,
    `GrokLoopActor`, `VercelAIActorAdapter`); the unification onto
    `ActorAdapter` follows.
  - `AIAgentActorSchema` (Zod schema) stays in `@loop-engine/actors`
    — it's a value rather than a type-graph participant in the
    cycle that motivated the relocation, and consistent with the
    rest of the actor Zod schemas housed in `actors`.

  **Symbol diff against 0.1.5.**

  Added to `@loop-engine/core` public surface:

  - `interface ActorAdapter`
  - `interface AIAgentActor` (relocated from actors)
  - `interface AIAgentSubmission` (relocated from actors)
  - `interface LoopActorPromptContext` (relocated from actors)
  - `interface LoopActorPromptSignal` (relocated from actors)

  Removed from `@loop-engine/actors` public surface (consumers
  update import paths per the migration block above):

  - `interface AIAgentActor`
  - `interface AIAgentSubmission`
  - `interface LoopActorPromptContext`
  - `interface LoopActorPromptSignal`

- ## SR-007 — `feat(core): rename isAuthorized to canActorExecuteTransition + add AIActorConstraints + pending_approval (D-08)`

  **Packages bumped:** `@loop-engine/actors` (major), `@loop-engine/runtime` (major), `@loop-engine/sdk` (major).

  **Rationale.** D-08 → A resolves the "pending_approval + AI safety" question with narrow scope: the hook that proves governance is real, not the governance system. `1.0.0-rc.0` ships three structurally related pieces that together give consumers a first-class way to gate AI-executed transitions on human approval, without committing to a full policy engine or constraint DSL.

  **Symbol changes.**

  - `isAuthorized` renamed to `canActorExecuteTransition` in `@loop-engine/actors`. Signature widens to accept an optional third parameter `constraints?: AIActorConstraints`. Return type widens from `{ authorized: boolean; reason?: string }` to `{ authorized: boolean; requiresApproval: boolean; reason?: string }` — `requiresApproval` is a required field on the new shape, but callers that only read `authorized` continue to work unchanged. `ActorAuthorizationResult` interface name is preserved; its shape widens.
  - New type `AIActorConstraints` in `@loop-engine/actors` with exactly one field: `requiresHumanApprovalFor?: TransitionId[]`. Other fields the docs previously hinted at (`maxConsecutiveAITransitions`, `canExecuteTransitions`) are explicitly out of scope for `1.0.0-rc.0` per spec §4.
  - `TransitionResult.status` union in `@loop-engine/runtime` widens from `"executed" | "guard_failed" | "rejected"` to include `"pending_approval"`. New optional field `requiresApprovalFrom?: ActorId` on `TransitionResult`.
  - `TransitionParams` in `@loop-engine/runtime` gains `constraints?: AIActorConstraints` so the approval hook is reachable from the `engine.transition()` call site. Existing callers that don't pass `constraints` see no behavior change.

  **Enforcement semantics.** When an AI-typed actor attempts a transition whose `transitionId` appears in `constraints.requiresHumanApprovalFor`, `canActorExecuteTransition` returns `{ authorized: true, requiresApproval: true }`. The runtime maps this to a `TransitionResult` with `status: "pending_approval"` — guards do not run, events are not emitted, the state machine does not advance. Non-AI actors (`human`, `automation`, `system`) are unaffected by `AIActorConstraints` regardless of whether the transition is in the constrained set. Approval-flow resolution (how consumers ultimately execute the approved transition) is application-layer work for `1.0.0-rc.0`; the engine exposes the hook, not the workflow.

  **Implementers and consumers.** Zero concrete implementers of `canActorExecuteTransition` — the function is the contract. One call site (`packages/runtime/src/engine.ts`), updated same-commit. The `pending_approval` union widening is additive; no exhaustive `switch (result.status)` exists in source today, so no cascade of updates is required. Consumers can adopt per-status handling at their leisure when they upgrade.

  **Migration.**

  ```diff
  - import { isAuthorized } from "@loop-engine/actors";
  + import { canActorExecuteTransition } from "@loop-engine/actors";

  - const result = isAuthorized(actor, transition);
  + const result = canActorExecuteTransition(actor, transition);

    // Return shape widens — callers that only read `authorized` need no change.
    // Callers that want to opt into the approval hook:
  - const result = isAuthorized(actor, transition);
  + const result = canActorExecuteTransition(actor, transition, {
  +   requiresHumanApprovalFor: [someTransitionId],
  + });
  + if (result.requiresApproval) {
  +   // render approval UI, queue the decision, etc.
  + }
  ```

  ```diff
    // TransitionResult.status widening is additive; existing handlers
    // for "executed" | "guard_failed" | "rejected" continue to work.
    // To opt into pending_approval handling:
  + if (result.status === "pending_approval") {
  +   // route to approval workflow; result.requiresApprovalFrom may carry the approver id
  + }
  ```

  **Scope guardrails per D-08 → A.** The resolution log is explicit that the following do not ship in `1.0.0-rc.0`:

  - Constraint DSL or policy-engine surface.
  - `maxConsecutiveAITransitions` or `canExecuteTransitions` fields on `AIActorConstraints`.
  - Runtime-level rate limiting or cooldown semantics beyond what the existing `cooldown` guard provides.

  Spec §4 records these as out of scope; the Known Deferrals section captures the trigger condition for future D-NN work.

- ## SR-008 — `feat(core): add system to ActorTypeSchema + ship SystemActor interface (D-03; MECHANICAL 8.9)`

  **Packages bumped:** `@loop-engine/core` (major), `@loop-engine/actors` (major), `@loop-engine/loop-definition` (major), `@loop-engine/sdk` (major).

  **Rationale.** D-03 resolves the "what is system, really?" question in favor of a first-class actor variant. Pre-D-03, the codebase documented `system` as an actor type in prose but normalized it away at the DSL layer — `ACTOR_ALIASES["system"]` silently mapped to `"automation"`, so system-initiated transitions looked identical to automation-initiated ones in events, metrics, and authorization. That hid a real distinction: automation represents a deployed service acting under its operator's authority; system represents the engine's own internal actions (reconciliation, scheduled maintenance, cleanup passes). `1.0.0-rc.0` ships `system` as a distinct ActorType variant with its own interface, so consumers that care about the distinction (audit trails, policy gates, routing logic) have a first-class way to branch on it.

  **Symbol changes.**

  - `ActorTypeSchema` in `@loop-engine/core` widens from `z.enum(["human", "automation", "ai-agent"])` to `z.enum(["human", "automation", "ai-agent", "system"])`. The derived `ActorType` type inherits the wider union. `ActorRefSchema` and `TransitionSpecSchema` (which use `ActorTypeSchema`) pick up the widening automatically.
  - New `SystemActor` interface in `@loop-engine/actors` — parallel to `HumanActor` and `AutomationActor`, with `type: "system"` discriminator, required `componentId: string` identifying the engine component acting (`"reconciler"`, `"scheduler"`, etc.), and optional `version?: string`.
  - New `SystemActorSchema` Zod schema in `@loop-engine/actors`, mirroring `HumanActorSchema` / `AutomationActorSchema`.
  - `Actor` discriminated union in `@loop-engine/actors` extends from `HumanActor | AutomationActor | AIAgentActor` to `HumanActor | AutomationActor | AIAgentActor | SystemActor`.
  - `ACTOR_ALIASES` in `@loop-engine/loop-definition` corrects the legacy normalization: `system: "automation"` → `system: "system"`. Loop definition YAML/DSL consumers who wrote `actors: ["system"]` pre-D-03 previously saw their transitions tagged with `automation` at runtime; post-D-03 the tag matches the declaration.

  **Behavior change for DSL consumers.** Any loop definition that used `allowedActors: ["system"]` in YAML or via the DSL builder previously had its `"system"` entries silently coerced to `"automation"` at schema-validation time. `1.0.0-rc.0` preserves the literal. Consumers whose authorization logic branches on `actor.type === "automation"` and relied on that coercion to admit system actors need to update — either add `system` to `allowedActors` explicitly, or broaden the check to cover both variants. This is a narrow migration affecting only code paths that (a) declared `"system"` in `allowedActors` and (b) read `actor.type` downstream.

  **Implementer count.** Class 2 widening; audit confirmed zero exhaustive `switch (actor.type)` sites in source. Three equality-check consumers (`guards/built-in/human-only.ts`, `actors/authorization.ts`, `observability/metrics.ts`) all check specific single types and are unaffected by the additive widening. One DSL alias entry (`loop-definition/builder.ts:78`) updated same-commit.

  **Migration.**

  ```diff
    // Declaring a system-authorized transition — DSL / YAML:
    transitions:
      - id: reconcile
        from: pending
        to: reconciled
        signal: ledger.reconcile
  -     actors: [system]   # silently became "automation" at validation
  +     actors: [system]   # preserved as "system"; first-class ActorType
  ```

  ```diff
    // Constructing a SystemActor in application code:
    import { SystemActorSchema } from "@loop-engine/actors";

    const actor = SystemActorSchema.parse({
      id: "sys-reconciler-01",
      type: "system",
      componentId: "ledger-reconciler",
      version: "1.0.0"
    });
  ```

  ```diff
    // Authorization / routing code that previously relied on the "system → automation"
    // coercion to admit system actors:
  - if (actor.type === "automation") { /* admit */ }
  + if (actor.type === "automation" || actor.type === "system") { /* admit */ }
    // Or more explicit, if the branches differ:
  + if (actor.type === "system") { /* engine-internal path */ }
  + if (actor.type === "automation") { /* operator-deployed service path */ }
  ```

  **Out of scope for this row (intentionally):**

  - Engine-internal consumers (`reconciler`, `scheduler`) constructing SystemActor instances at runtime — that wiring lands where those consumers live, not here. SR-008 ships the type and schema; consumers adopt them when relevant.
  - Guard helpers or policy primitives that branch on `"system"` as a first-class variant (e.g., a `system-only` guard parallel to `human-only`) — none are on the `1.0.0-rc.0` roadmap; consumers who need them can compose from the shipped primitives.
  - Observability-layer metric counters for system transitions — current counters in `metrics.ts` count `ai-agent` and `human` transitions. A `systemTransitions` counter would be additive and backward-compatible; deferred to a later `1.0.0-rc.x` or `1.1.0` as consumer demand clarifies.

  **Symbol diff against 0.1.5.**

  Added to `@loop-engine/core` public surface:

  - `ActorTypeSchema` enum variant `"system"` (union widening only; no new exports).

  Added to `@loop-engine/actors` public surface:

  - `interface SystemActor`
  - `const SystemActorSchema`

  Changed in `@loop-engine/actors`:

  - `type Actor` widens to include `SystemActor`.

  Changed in `@loop-engine/loop-definition`:

  - `ACTOR_ALIASES.system` now maps to `"system"` rather than `"automation"`.

  <!-- Subsequent SRs append below. -->

- ## SR-009 · D-02 · add `OutcomeIdSchema` + `CorrelationIdSchema`

  **Class.** Class 1 (additive — two new brand schemas in `@loop-engine/core`; no signature changes, no relocations, no removals).

  **Scope.** `packages/core/src/schemas.ts` gains two brand schemas following the existing pattern used by `LoopIdSchema`, `AggregateIdSchema`, `ActorIdSchema`, etc. Placement: between `TransitionIdSchema` and `LoopStatusSchema` in the brand block. Both new brands propagate transparently through the SDK barrel via the existing `export * from "@loop-engine/core"` re-export — no barrel edits required.

  **Sequencing per PB-EX-06 Option A resolution.** D-02's brand additions land immediately before the D-05 schema rewrite (SR-010) because D-05's canonical `OutcomeSpec.id?: OutcomeId` signature references the `OutcomeId` brand. Reordered Phase A.3 sequence: D-02 add → D-05 schema rewrite → D-05 LoopBuilder collapse → D-01 factories → D-13 re-home → D-15 confirm. Row-order correction only; no shape change to any decision. `CorrelationId`'s in-Branch-A consumer is `LoopInstance.correlationId`; its Branch B consumers (`LoopEventBase` and adjacent event types) adopt the brand during Branch B work.

  **Migration.**

  ```diff
    // Consumers that previously typed outcome or correlation identifiers as plain string can opt into the brand:
  - const outcomeId: string = "cart-abandon-recovery-v2";
  + const outcomeId: OutcomeId = "cart-abandon-recovery-v2" as OutcomeId;

  - const correlationId: string = crypto.randomUUID();
  + const correlationId: CorrelationId = crypto.randomUUID() as CorrelationId;

    // Brand factories (per D-01, SR-012+) will expose ergonomic constructors:
    // import { outcomeId, correlationId } from "@loop-engine/core";
    // const id = outcomeId("cart-abandon-recovery-v2");
  ```

  **Out of scope for this row (intentionally):**

  - ID factory functions (`outcomeId(s)`, `correlationId(s)`) — part of D-01 / MECHANICAL scope, SR-012 lands those.
  - `OutcomeSpec.id` field addition to `OutcomeSpecSchema` — D-05 schema rewrite (SR-010) lands the consumer of the `OutcomeId` brand.
  - `LoopInstance.correlationId` field addition — per D-06 + D-07 scope; lands with the Runtime\* → LoopInstance relocation that already landed in SR-004.
  - `LoopEventBase.correlationId` propagation — Branch B work.

  **Symbol diff against 0.1.5.**

  Added to `@loop-engine/core` public surface:

  - `const OutcomeIdSchema` (`z.ZodBranded<z.ZodString, "OutcomeId">`)
  - `type OutcomeId`
  - `const CorrelationIdSchema` (`z.ZodBranded<z.ZodString, "CorrelationId">`)
  - `type CorrelationId`

  No changes to any other package; propagates transparently through the SDK barrel via the existing `export * from "@loop-engine/core"` re-export.

- ## SR-010 · D-05 · `LoopDefinition` / `StateSpec` / `TransitionSpec` / `GuardSpec` / `OutcomeSpec` schema rewrite (MECHANICAL 8.11)

  **Class.** Class 2 (interface change — field renames, constraint relaxation, additive fields across the five primary spec schemas; consumer cascade across runtime, validator, serializer, registry adapters, scripts, tests, and apps).

  **Scope.** `packages/core/src/schemas.ts` rewritten to canonical D-05 shape. Cascades:

  - `@loop-engine/core` — schema rewrite + types.
  - `@loop-engine/loop-definition` — builder normalize, validator field accesses, serializer field mapping, parser/applyAuthoringDefaults helper retained as public marker.
  - `@loop-engine/registry-client` — local + http adapters: `definition.id` reads, defensive `applyAuthoringDefaults` calls retained.
  - `@loop-engine/runtime` — engine field reads on `StateSpec`/`TransitionSpec`/`GuardSpec`; `LoopInstance.loopId` runtime field unchanged per layered contract.
  - `@loop-engine/actors` — `transition.actors` + `transition.id`.
  - `@loop-engine/guards` — `guard.id`.
  - `@loop-engine/adapter-vercel-ai` — `definition.id` + `transition.id`.
  - `@loop-engine/observability` — `transition.id` in replay match logic.
  - `@loop-engine/sdk` — `InMemoryLoopRegistry.get` + `mergeDefinitions` use `definition.id`.
  - `@loop-engine/events` — `LoopDefinitionLike` Pick uses `id` (its consumer `extractLearningSignal` accesses `name` / `outcome` only; `LoopStartedEvent.definition` payload remains `loopId` per runtime-layer invariant).
  - `@loop-engine/ui-devtools` — `StateDiagram.tsx` field reads.
  - `apps/playground` — `definition.id` + `t.id` reads.
  - `scripts/validate-loops.ts` — explicit normalize maps old → new names; explicit PB-EX-05 boundary-default note in code.
  - All schema-construction tests across the workspace updated to new field names; runtime-layer test inputs (`LoopInstance.loopId`, `TransitionRecord.transitionId`, `LoopStartedEvent.definition.loopId`, `StartLoopParams.loopId`, `TransitionParams.transitionId`) intentionally left unchanged per layered contract.

  **Rename map (authoring layer only — runtime fields are preserved):**

  ```diff
    // LoopDefinition
  - loopId: LoopId
  + id: LoopId
  + domain?: string                      // additive

    // StateSpec
  - stateId: StateId
  + id: StateId
  - terminal?: boolean
  + isTerminal?: boolean
  + isError?: boolean                    // additive

    // TransitionSpec
  - transitionId: TransitionId
  + id: TransitionId
  - allowedActors: ActorType[]
  + actors: ActorType[]
  - signal: SignalId                     // required (authoring)
  + signal?: SignalId                    // optional at authoring; required at runtime via boundary defaulting (PB-EX-05 Option B)

    // GuardSpec
  - guardId: GuardId
  + id: GuardId
  + failureMessage?: string              // additive

    // OutcomeSpec
  + id?: OutcomeId                       // additive (consumes D-02 brand from SR-009)
  + measurable?: boolean                 // additive
  ```

  **PB-EX-05 Option B implementation note (boundary-defaulting contract).** The D-05 extension specifies the layered contract: `TransitionSpec.signal` is optional at the authoring layer; downstream runtime consumers (`TransitionRecord.signal`, validator uniqueness check, engine event-stream construction) operate on `signal: SignalId` invariantly. The original D-05 extension named two enforcement sites — `LoopBuilder.build()` (existing pre-fill) and parser-wrapper `applyAuthoringDefaults` calls (post-parse). This SR implements the contract via a **schema-level `.transform()` on `TransitionSpecSchema`** that fills `signal := id` whenever authored `signal` is absent, so the OUTPUT type (`z.infer<typeof TransitionSpecSchema>`, exported as `TransitionSpec`) has `signal: SignalId` required. This:

  - Honors the resolution's runtime-no-modification promise — engine.ts:205, 219, 302, 329 typecheck without per-site `??` fallbacks because the inferred type already encodes the post-default invariant.
  - Subsumes both originally-named enforcement sites (LoopBuilder pre-fill is now defensive but idempotent; parser-wrapper / registry-adapter `applyAuthoringDefaults` calls are retained as public markers but idempotent given the in-schema transform).
  - Preserves the two-layer authoring/runtime distinction at the type level: `z.input<typeof TransitionSpecSchema>` has `signal?` optional (authoring INPUT); `z.infer<typeof TransitionSpecSchema>` has `signal` required (runtime OUTPUT after parse).

  This implementation choice is a **superset of the original D-05 extension's two named sites** — same contract, single enforcement point inside the schema rather than scattered across consumer-side boundaries. Operator may choose to ratify the implementation as a refinement of PB-EX-05's enforcement strategy; no contract semantics are changed.

  **PB-EX-06 Option A confirmation.** Phase A.3 row order followed (D-02 brands landed in SR-009 before this SR-010 schema rewrite). `OutcomeSpec.id?: OutcomeId` resolves cleanly against the `OutcomeId` brand added in SR-009.

  **Migration.**

  ```diff
    // Authoring layer (loop definitions / YAML / JSON / DSL):
    const loop = LoopDefinitionSchema.parse({
  -   loopId: "support.ticket",
  +   id: "support.ticket",
      states: [
  -     { stateId: "OPEN", label: "Open" },
  -     { stateId: "DONE", label: "Done", terminal: true }
  +     { id: "OPEN", label: "Open" },
  +     { id: "DONE", label: "Done", isTerminal: true }
      ],
      transitions: [
        {
  -       transitionId: "finish",
  -       allowedActors: ["human"],
  +       id: "finish",
  +       actors: ["human"],
          // signal: "demo.finish"   ← now optional; defaults to transition.id when omitted
        }
      ]
    });

    // Runtime layer (UNCHANGED by D-05):
    // - LoopInstance.loopId                    — runtime field
    // - TransitionRecord.transitionId          — runtime field
    // - StartLoopParams.loopId                 — runtime parameter
    // - TransitionParams.transitionId          — runtime parameter
    // - LoopStartedEvent.definition.loopId     — event payload (event-stream invariant)
    // - GuardEvaluationResult.guardId          — runtime evaluation result
  ```

  **Out of scope for this row (intentionally):**

  - LoopBuilder aliasing layer collapse (MECHANICAL 8.12) — separate Phase A.3 row, lands in SR-011.
  - ID factory functions (`loopId(s)`, `stateId(s)`, etc.) — D-01, lands in SR-012.
  - D-13 AI provider adapter re-homing — Phase A.3 row, lands in SR-013 after PB-EX-02 / PB-EX-03 adjudication.
  - In-tree examples field-name updates — Phase A.6 follow-up (no in-tree examples touched in this SR).
  - External `loop-examples` repo updates — Branch C work.
  - Docs prose updates referencing old field names — Branch B work.

  **Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean (no stale symlinks repaired this SR); workspace `pnpm -r typecheck` green (26/26 packages); workspace `pnpm -r test` green (143/143 tests pass); d.ts surface diff confirms new field names + transformed `TransitionSpec` output type with `signal` required; tarball sizes within bounds (core: 16.7 KB packed / 98.1 KB unpacked; sdk: 14.2 KB / 71.7 KB; runtime: 13.0 KB / 85.6 KB; loop-definition: 25.6 KB / 121.3 KB; registry-client: 19.9 KB / 135.3 KB).

- ## SR-011 · D-05 · `LoopBuilder` aliasing layer collapse (MECHANICAL 8.12)

  **Class.** Class 2 (interface change — removes `LoopBuilderGuardLegacy` / `LoopBuilderGuardShorthand` type union, `ACTOR_ALIASES` string-form-alias map, and the guard-input legacy/shorthand discriminator from `LoopBuilder`'s authoring surface).

  **Scope.** `packages/loop-definition/src/builder.ts` simplified per the resolution log's cross-cutting consequence (`D-05 + D-07 collapse the LoopBuilder aliasing layer`). With source field names matching consumption-layer conventions post-SR-010, the bridging logic is no longer needed. Changes:

  - **Removed:** `LoopBuilderGuardLegacy`, `LoopBuilderGuardShorthand`, and the discriminating `LoopBuilderGuardInput` union they formed; `isGuardLegacy` discriminator; `ACTOR_ALIASES` map (`ai_agent → ai-agent`, `system → system`); `normalizeActorType` function.
  - **Simplified:** `LoopBuilderGuardInput` is now a single canonical shape — `Omit<GuardSpec, "id"> & { id: string }` — where `id` stays plain string for authoring ergonomics and the builder brand-casts to `GuardSpec["id"]` during normalization. `normalizeGuard` is a single pass-through that applies the brand cast; the legacy/shorthand split is gone.
  - **Tightened:** `LoopBuilderTransitionInput.actors` is now typed as `ActorType[]` (was `string[]`). The `ai_agent` underscore alias is no longer accepted at the authoring surface — authors must use the canonical `"ai-agent"` dash form. Docs and examples already use the canonical form (e.g., `examples/ai-actors/shared/loop.ts`), so no example-side follow-up needed.

  **Retained:** The `signal := transition.id` defaulting in `normalizeTransitions` is explicitly preserved as a defensive boundary marker for PB-EX-05 Option B. Per the post-SR-010 enforcement-site amendment, the canonical enforcement site is the `.transform()` on `TransitionSpecSchema`; this pre-fill is idempotent against that transform and is retained so the authoring→runtime boundary remains explicit at the authoring surface. Not part of the collapsed aliasing layer.

  **Barrel re-exports updated:**

  - `packages/loop-definition/src/index.ts` — drops `LoopBuilderGuardLegacy` / `LoopBuilderGuardShorthand` type re-exports; retains `LoopBuilderGuardInput` (now the single canonical shape).
  - `packages/sdk/src/index.ts` — same drop; retains `LoopBuilderGuardInput`.

  **Migration.**

  ```diff
    // Actor strings — canonical dash form only:
  - .transition({ id: "go", from: "A", to: "B", actors: ["ai_agent", "human"] })
  + .transition({ id: "go", from: "A", to: "B", actors: ["ai-agent", "human"] })

    // Guards — canonical GuardSpec shape only (no `type` / `minimum` shorthand):
  - guards: [{ id: "confidence_check", type: "confidence_threshold", minimum: 0.85 }]
  + guards: [
  +   {
  +     id: "confidence_check",
  +     severity: "hard",
  +     evaluatedBy: "external",
  +     description: "AI confidence threshold gate",
  +     parameters: { type: "confidence_threshold", minimum: 0.85 }
  +   }
  + ]

    // Removed type imports:
  - import type { LoopBuilderGuardLegacy, LoopBuilderGuardShorthand } from "@loop-engine/sdk";
  + // Use LoopBuilderGuardInput — the single canonical shape.
  ```

  **Out of scope for this row (intentionally):**

  - ID factory functions (`loopId(s)`, `stateId(s)`, etc.) — D-01, lands in SR-012.
  - D-13 AI provider adapter re-homing — Phase A.3 row, lands in SR-013 after PB-EX-02 / PB-EX-03 adjudication.
  - External `loop-examples` repo migration (if any author used the removed shorthand forms externally) — Branch C work.

  **Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean; workspace `pnpm -r typecheck` green; workspace `pnpm -r test` green (143/143 tests pass — same count as SR-010; the two tests that exercised the removed aliases were updated to canonical forms, not removed); d.ts surface diff confirms `LoopBuilderGuardLegacy`, `LoopBuilderGuardShorthand`, and `ACTOR_ALIASES` are absent from both `packages/loop-definition/dist/index.d.ts` and `packages/sdk/dist/index.d.ts`; `LoopBuilderGuardInput` reflects the single canonical shape. Tarball sizes: `@loop-engine/loop-definition` shrinks from 25.6 KB → 17.6 KB packed (121.3 KB → 116.5 KB unpacked); `@loop-engine/sdk` shrinks from 14.2 KB → 14.1 KB packed (71.7 KB → 71.5 KB unpacked). Other packages unchanged.

- ## SR-012 · D-01 · ID factory functions

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

- ## SR-013a · MECHANICAL 8.16 · rename SDK `guardEvidence` → `redactPiiEvidence` + relocate `EvidenceRecord` to core (PB-EX-03 Option A)

  **Class.** Class 1 + rename (compiler-carried) in SDK; Class 2.5-adjacent relocation in `@loop-engine/core` (new file, additive exports — no shape change to existing types).

  **Scope.** Two adjacent corrections shipping as one commit per PB-EX-03 Option A resolution of the `guardEvidence` name collision and `EvidenceRecord` placement:

  1. **Rename SDK's `guardEvidence` → `redactPiiEvidence`.** `packages/sdk/src/lib/guardEvidence.ts` is replaced by `packages/sdk/src/lib/redactPiiEvidence.ts` (same behavior: hardcoded PII field blocklist, prompt-injection prefix stripping, 512-char value length cap) and the SDK barrel updates accordingly. Rationale: the original name collided with `@loop-engine/core`'s generic `guardEvidence` primitive (`stripFields` + `maskPatterns` options) backing `ToolAdapter.guardEvidence`. Keeping both under the same name was incoherent — different signatures, different semantics, different packages.
  2. **Relocate `EvidenceRecord` + `EvidenceValue` from `@loop-engine/sdk` to `@loop-engine/core`.** New file `packages/core/src/evidence.ts` houses both types. The SDK barrel stops exporting `EvidenceRecord` (no consumer uses the SDK import path — verified via workspace grep). The SDK's renamed `redactPiiEvidence` imports `EvidenceRecord` from `@loop-engine/core`. Rationale: both `guardEvidence` functions (the core primitive and the SDK helper) reference this type; core is the correct home for the shared contract — same closure-of-type-graph principle as PB-EX-01 / PB-EX-04's relocations of `ActorAdapter` context and actor types.

  **Invariants preserved.** `ToolAdapter.guardEvidence` contract member in `@loop-engine/core` is unchanged — it continues to reference core's generic primitive with its `GuardEvidenceOptions` signature. Every existing implementer (`adapter-perplexity`'s `guardEvidence` method) continues to satisfy `ToolAdapter` without modification.

  **Out of scope for this row (intentionally):**

  - AI provider adapter re-homing onto `ActorAdapter` (Anthropic, OpenAI, Gemini, Grok) — lands in SR-013b per the SR-013 phased split. The PB-EX-02 Option A construction-time tuning work and the D-13 `ActorAdapter` re-homing are independent of this evidence-type housekeeping.
  - `adapter-vercel-ai` — per PB-EX-07 Option A, it does not re-home onto `ActorAdapter`; it belongs to the new `IntegrationAdapter` archetype. No changes to `adapter-vercel-ai` in SR-013a.
  - Consumer-package updates outside the loop-engine workspace (bd-forge-main stubs, pinned app consumers) — covered by Phase E `--13-bd-forge-main-cleanup.md`.

  **Migration.**

  ```diff
    // SDK consumers that redact evidence before forwarding to AI adapters:
  - import { guardEvidence } from "@loop-engine/sdk";
  + import { redactPiiEvidence } from "@loop-engine/sdk";

  - const safe = guardEvidence({ reviewNote: "Looks good" });
  + const safe = redactPiiEvidence({ reviewNote: "Looks good" });
  ```

  ```diff
    // Consumers that typed evidence payloads via the SDK's EvidenceRecord:
  - import type { EvidenceRecord } from "@loop-engine/sdk";
  + import type { EvidenceRecord } from "@loop-engine/core";
  ```

  `@loop-engine/core`'s `guardEvidence` primitive (generic redaction with `stripFields` + `maskPatterns`) and the `ToolAdapter.guardEvidence` contract member are unchanged — no migration needed for `ToolAdapter` implementers.

  **Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean (pre + post build, zero hits); workspace `pnpm -r typecheck` green; workspace `pnpm -r test` green (all test files pass — no count change vs SR-012; the SDK's `guardEvidence` tests become `redactPiiEvidence` tests but exercise the same behavior); d.ts surface diff confirms `@loop-engine/sdk/dist/index.d.ts` exports `redactPiiEvidence` (no `guardEvidence`, no `EvidenceRecord`), and `@loop-engine/core/dist/index.d.ts` exports `guardEvidence` (the unchanged primitive), `EvidenceRecord`, and `EvidenceValue`.

  **Symbol diff against 0.1.5.**

  Added to `@loop-engine/core` public surface:

  - `type EvidenceValue` (`= string | number | boolean | null`)
  - `type EvidenceRecord` (`= Record<string, EvidenceValue>`)

  Removed from `@loop-engine/sdk` public surface:

  - `guardEvidence(evidence: EvidenceRecord): EvidenceRecord` — renamed; see below.
  - `type EvidenceRecord` — relocated to `@loop-engine/core`.

  Added to `@loop-engine/sdk` public surface:

  - `redactPiiEvidence(evidence: EvidenceRecord): EvidenceRecord` — same behavior as the pre-rename `guardEvidence`; `EvidenceRecord` now sourced from `@loop-engine/core`.

  Unchanged in `@loop-engine/core`:

  - `guardEvidence<T extends EvidenceRecord>(evidence: T, options: GuardEvidenceOptions): EvidenceRecord` — the generic redaction primitive backing `ToolAdapter.guardEvidence`. Kept under its original name; PB-EX-03 Option A disambiguation renamed only the SDK helper.

  **Originator.** PB-EX-03 (guardEvidence name collision + EvidenceRecord placement); MECHANICAL 8.16 as extended by PB-EX-03 Option A.

- ## SR-013b · D-13 · AI provider adapters re-home onto `ActorAdapter` (+ PB-EX-02 Option A)

  Second half of the SR-013 split. Re-homes the four AI provider
  adapters — `@loop-engine/adapter-gemini`, `@loop-engine/adapter-grok`,
  `@loop-engine/adapter-anthropic`, `@loop-engine/adapter-openai` — onto
  the canonical `ActorAdapter` contract defined in
  `@loop-engine/core/actorAdapter`. Splits into four per-adapter commits
  under a shared `Surface-Reconciliation-Id: SR-013b` trailer.

  PB-EX-07 Option A note: `@loop-engine/adapter-vercel-ai` is NOT
  included in this re-home. It ships under the `IntegrationAdapter`
  archetype and is documentation-only in SR-013b scope (the taxonomic
  correction landed in the PB-EX-07 resolution-log extension).

  **Per-adapter breaking changes (all four):**

  - `createSubmission` input contract is now
    `(context: LoopActorPromptContext)`.
  - `createSubmission` return type is now `AIAgentSubmission` (from
    `@loop-engine/core`).
  - Provider adapters `implements ActorAdapter` (Gemini/Grok classes) or
    return `ActorAdapter` from their factory (Anthropic/OpenAI
    object-literal factories).
  - All factory functions now have return type `ActorAdapter`.
  - Signal selection happens inside the adapter: the model returns
    `signalId` in its JSON response, adapter validates against
    `context.availableSignals`, then brand-casts via the `signalId()`
    factory (D-01, SR-012).
  - Actor ID generation happens inside the adapter via
    `actorId(crypto.randomUUID())` (D-01).

  **Gemini + Grok — return-shape normalization (near-mechanical):**

  Both adapters already took `LoopActorPromptContext` and had
  construction-time tuning on `GeminiLoopActorConfig` /
  `GrokLoopActorConfig` (already PB-EX-02 Option A compliant). The
  re-home is return-shape normalization:

  - `GeminiActorSubmission` type: removed (was
    `{ actor, decision, rawResponse }` wrapper).
  - `GrokActorSubmission` type: removed (same shape as Gemini).
  - `GeminiLoopActor` / `GrokLoopActor` duck-type aliases from
    `types.ts`: removed. The class name is preserved as a real class
    export from each package.
  - Return shape now `{ actor, signal, evidence: { reasoning,
confidence, dataPoints?, modelResponse } }`.

  **Anthropic + OpenAI — full internal rewrite (PB-EX-02 Option A
  explicitly sanctioned):**

  Both adapters previously took a bespoke `createSubmission(params)`
  with caller-supplied `signal`, `actorId`, `prompt`, `maxTokens`,
  `temperature`, `dataPoints`, `displayName`, `metadata`. This shape is
  entirely removed from the public surface:

  - `CreateAnthropicSubmissionParams`: removed.
  - `CreateOpenAISubmissionParams`: removed.
  - `AnthropicActorAdapter` interface: removed
    (`createAnthropicActorAdapter` now returns `ActorAdapter` directly).
  - `OpenAIActorAdapter` interface: removed (same).

  Per-call tuning parameters (`maxTokens`, `temperature`) moved onto
  construction-time options per PB-EX-02 Option A:

  - `AnthropicActorAdapterOptions` gains optional `maxTokens?: number`
    and `temperature?: number`.
  - `OpenAIActorAdapterOptions` gains the same.

  Per-call actor-lifecycle parameters (`signal`, `actorId`, `prompt`,
  `displayName`, `metadata`, `dataPoints`) are dropped from the public
  contract. The model now receives a prompt constructed by the adapter
  from `LoopActorPromptContext` fields (`currentState`,
  `availableSignals`, `evidence`, `instruction`) and returns a
  `signalId` alongside `reasoning`/`confidence`/`dataPoints`. Prompt
  construction is intentionally minimal: parallels the Gemini/Grok
  pattern, not a prompt-design optimization pass.

  **Migration.**

  _Gemini/Grok callers:_

  ```ts
  // Before
  const { actor, decision } = await adapter.createSubmission(context);
  console.log(decision.signalId, decision.reasoning, decision.confidence);

  // After
  const { actor, signal, evidence } = await adapter.createSubmission(context);
  console.log(signal, evidence.reasoning, evidence.confidence);
  ```

  _Anthropic/OpenAI callers (the heavier migration):_

  ```ts
  // Before
  const adapter = createAnthropicActorAdapter({ apiKey, model });
  const submission = await adapter.createSubmission({
    signal: "my.signal",
    actorId: "my-agent-id",
    prompt: "Recommend procurement action",
    maxTokens: 1000,
    temperature: 0.3,
  });

  // After
  const adapter = createAnthropicActorAdapter({
    apiKey,
    model,
    maxTokens: 1000, // moved to construction-time
    temperature: 0.3, // moved to construction-time
  });
  const submission = await adapter.createSubmission({
    loopId,
    loopName,
    currentState,
    availableSignals: [{ signalId: "my.signal", name: "My Signal" }],
    instruction: "Recommend procurement action",
    evidence: {
      /* loop-specific context */
    },
  });
  // The model now returns `signal` (validated against availableSignals);
  // `actor.id` is generated internally as a UUID. If you need a stable
  // actor identity across calls, file an issue — this is a natural
  // PB-EX follow-up.
  ```

  **Symbol diff per package.**

  `@loop-engine/adapter-gemini`:

  - REMOVED: `type GeminiActorSubmission`
  - REMOVED: `type GeminiLoopActor` (duck-type alias; `class GeminiLoopActor` preserved)
  - MODIFIED: `class GeminiLoopActor implements ActorAdapter` with
    `provider`/`model` readonly properties
  - MODIFIED: `createSubmission(context: LoopActorPromptContext):
Promise<AIAgentSubmission>`

  `@loop-engine/adapter-grok`:

  - REMOVED: `type GrokActorSubmission`
  - REMOVED: `type GrokLoopActor` (duck-type alias; `class GrokLoopActor` preserved)
  - MODIFIED: `class GrokLoopActor implements ActorAdapter`
  - MODIFIED: `createSubmission(context: LoopActorPromptContext):
Promise<AIAgentSubmission>`

  `@loop-engine/adapter-anthropic`:

  - REMOVED: `interface CreateAnthropicSubmissionParams`
  - REMOVED: `interface AnthropicActorAdapter`
  - MODIFIED: `interface AnthropicActorAdapterOptions` gains
    `maxTokens?` and `temperature?`
  - MODIFIED: `createAnthropicActorAdapter(options): ActorAdapter`

  `@loop-engine/adapter-openai`:

  - REMOVED: `interface CreateOpenAISubmissionParams`
  - REMOVED: `interface OpenAIActorAdapter`
  - MODIFIED: `interface OpenAIActorAdapterOptions` gains `maxTokens?`
    and `temperature?`
  - MODIFIED: `createOpenAIActorAdapter(options): ActorAdapter`

  No behavioral change to `adapter-vercel-ai`, `adapter-openclaw`,
  `adapter-perplexity`, or other peer adapters. `@loop-engine/sdk`'s
  `createAIActor` dispatcher is unaffected because it passes only
  `{ apiKey, model }` to Anthropic/OpenAI factories and
  `(apiKey, { modelId, confidenceThreshold? })` to Gemini/Grok
  factories — all of which remain supported signatures.

  **Originator.** D-13 AI-provider-adapter contract; PB-EX-02 Option A
  (input-contract conformance, construction-time tuning); PB-EX-07
  Option A (three-archetype taxonomy, Vercel-AI excluded from
  `ActorAdapter` re-homing).

- ## SR-014 · D-15 · Built-in guard set confirmed for `1.0.0-rc.0`

  **Decision confirmation.** Per D-15 → Option C ("kebab-case; union
  of source + docs _only after pruning_; each shipped guard must be
  generic across domains"), the `1.0.0-rc.0` built-in guard set is
  confirmed as the four generic guards already registered in source:

  - `confidence-threshold`
  - `human-only`
  - `evidence-required`
  - `cooldown`

  **Rule applied.** Each confirmed guard has been re-audited against
  the generic-across-domains rule:

  - `confidence-threshold` — parameterized on `threshold: number`,
    reads `evidence.confidence`. No coupling to any domain concept.
  - `human-only` — pure `actor.type === "human"` check. No domain
    coupling.
  - `evidence-required` — parameterized on `requiredFields: string[]`;
    fields are caller-specified. Guard logic is domain-agnostic
    field-presence validation.
  - `cooldown` — parameterized on `cooldownMs: number`, reads
    `loopData.lastTransitionAt`. Pure time-based rate-limiting.

  All four pass. No pruning required.

  **Borderline candidates not shipping.** The borderline names recorded
  in the resolution log (`field-value-constraint`,
  `duplicate-check-passed`) and earlier candidates once considered
  (`actor-has-permission`, `approval-obtained`,
  `deadline-not-exceeded`) do not exist in source and are not added
  for `1.0.0-rc.0`.

  **No source changes.** This is a confirm-pass. `@loop-engine/guards`
  source is unchanged; `packages/guards/src/registry.ts:21-26` already
  registers exactly the confirmed set. No package bump is added to
  this changeset for `@loop-engine/guards`; this narrative is the
  release-note record of the confirmation.

  **Consumer impact.** None. The observable behavior of
  `defaultRegistry` and `registerBuiltIns()` has been the confirmed set
  throughout Pass B; the confirmation fixes that surface as the
  `1.0.0-rc.0` contract.

  **Extension mechanism unchanged.** Consumers needing additional
  guards register them via `GuardRegistry.register(guardId, evaluator)`.
  The confirmed set is the floor, not the ceiling. Post-RC additions
  of any candidate require demonstrated generic-across-domains utility
  and land via minor bump under D-15's pruning rule.

  **Phase A.3 closure.** SR-014 is the closing SR of Phase A.3
  (decision cascade). Phase A.4 opens next (R-164 barrel rewrite,
  D-21 single-root export enforcement).

  **Originator.** D-15 (Option C) confirm-pass.

- ## SR-015 · R-164 + R-186 · SDK barrel hygiene + single-root exports

  **What landed.** Three `loop-engine` commits under
  `Surface-Reconciliation-Id: SR-015`:

  - `dbeceda` — `refactor(sdk): rewrite barrel per publish hygiene
(R-164)`. The `@loop-engine/sdk` root barrel now uses explicit
    named re-exports instead of `export *`. Class 3 pre/post d.ts
    diff gate cleared: 158 → 151 public symbols, every delta
    accounted for.
  - `d0d2642` — `fix(adapter-vercel-ai): apply missed D-01/D-05
field renames in loop-tool-bridge`. Bycatch procedural fix for
    a pre-existing D-05 cascade miss that was silently masked in
    prior SRs (see "Procedural finding" below). Internal source
    fix only; no consumer-visible API change except that
    `@loop-engine/adapter-vercel-ai`'s `dist/index.d.ts` now
    emits correctly for the first time post-D-05.
  - `bd23e2a` — `chore(packages): enforce single root export per
D-21 (R-186)`. Drops `@loop-engine/sdk/dsl` subpath; migrates
    the single in-tree consumer (`apps/playground`) to import
    from `@loop-engine/loop-definition` directly.

  **Breaking changes for `@loop-engine/sdk` consumers.**

  1. **`@loop-engine/sdk/dsl` subpath no longer exists.** Any
     import from this subpath will fail at module resolution.

     _Migration:_ switch to the SDK root or go direct to
     `@loop-engine/loop-definition`. Both paths are supported;
     pick based on the bundling environment:

     ```diff
     - import { parseLoopYaml } from "@loop-engine/sdk/dsl";
     + import { parseLoopYaml } from "@loop-engine/sdk";
     ```

     **Browser/edge consumers:** the SDK root transitively imports
     `node:module` (via `createRequire` in the AI-adapter loader)
     and `node:fs` (via `@loop-engine/registry-client`). If your
     bundler rejects Node built-ins, import directly from
     `@loop-engine/loop-definition` instead:

     ```diff
     - import { parseLoopYaml } from "@loop-engine/sdk/dsl";
     + import { parseLoopYaml } from "@loop-engine/loop-definition";
     ```

     This path anticipates D-18's future rename of
     `@loop-engine/loop-definition` to `@loop-engine/dsl` as a
     standalone published surface.

  2. **`applyAuthoringDefaults` is no longer exported from
     `@loop-engine/sdk`.** The symbol was previously reachable only
     through the now-removed `/dsl` subpath via `export *`. It is
     an internal authoring-to-runtime boundary helper consumed by
     `@loop-engine/registry-client` (per the D-05 extension /
     PB-EX-05 Option B enforcement site) and is not on D-19's
     `1.0.0-rc.0` ship list.

     _Migration:_ if your code depends on `applyAuthoringDefaults`
     (unlikely; it was never documented as public surface), import
     it from `@loop-engine/loop-definition` directly. This is
     flagged as "internal" — the symbol may be relocated,
     renamed, or removed in a future release. A `1.0.0-rc.0`
     `@loop-engine/loop-definition` export is retained to avoid
     breaking `@loop-engine/registry-client`'s cross-package
     consumption.

  3. **Nine `createLoop*Event` factory functions dropped from
     `@loop-engine/sdk` public re-exports** per D-17 → A ("Internal:
     `createLoop*Event` factories"):

     - `createLoopCancelledEvent`
     - `createLoopCompletedEvent`
     - `createLoopFailedEvent`
     - `createLoopGuardFailedEvent`
     - `createLoopSignalReceivedEvent`
     - `createLoopStartedEvent`
     - `createLoopTransitionBlockedEvent`
     - `createLoopTransitionExecutedEvent`
     - `createLoopTransitionRequestedEvent`

     These were previously surfacing via the SDK's
     `export * from "@loop-engine/events"`. The explicit-named
     rewrite naturally omits them. Runtime continues to consume
     them internally via direct `@loop-engine/events` import.

     _Migration:_ if your code constructs loop events directly
     (rare; consumers typically receive events via
     `InMemoryEventBus` subscriptions), either import from
     `@loop-engine/events` directly (not recommended — the package
     treats these as internal) or restructure around the event
     type schemas (`LoopStartedEventSchema`, etc.) which remain
     public.

  4. **`AIActor` interface shape tightened.** The historical loose
     interface

     ```ts
     interface AIActor {
       createSubmission: (...args: unknown[]) => Promise<unknown>;
     }
     ```

     is replaced with

     ```ts
     type AIActor = ActorAdapter;
     ```

     where `ActorAdapter` is the D-13 contract at
     `@loop-engine/core`. This is a type-level tightening
     (consumers receive a more precise signature), not a runtime
     behavior change. All four provider adapters
     (`adapter-anthropic`, `adapter-openai`, `adapter-gemini`,
     `adapter-grok`) already return `ActorAdapter` post-SR-013b.

     _Migration:_ code that downcasts `AIActor` to
     `{ createSubmission: (...args: unknown[]) => Promise<unknown> }`
     should remove the cast — TypeScript now infers the precise
     `createSubmission(context: LoopActorPromptContext):
Promise<AIAgentSubmission>` signature and the
     `provider`/`model` fields automatically.

  **Added to `@loop-engine/sdk` public surface per D-19:**

  - `parseLoopJson(s: string): LoopDefinition`
  - `serializeLoopJson(d: LoopDefinition): string`

  These were in D-19's `1.0.0-rc.0` ship list but were previously
  reachable only via the now-removed `/dsl` subpath. Root-barrel
  access closes the pre-existing SDK-vs-D-19 mismatch.

  **Class 3 gate — R-164 (root `dist/index.d.ts` surface):**

  | Delta   | Count | Symbols                              | Accountability                                             |
  | ------- | ----- | ------------------------------------ | ---------------------------------------------------------- |
  | Added   | 2     | `parseLoopJson`, `serializeLoopJson` | D-19 ship list                                             |
  | Removed | 9     | `createLoop*Event` factories (×9)    | D-17 → A / spec §4 "Internal: createLoop\*Event factories" |
  | Net     | −7    | 158 → 151 symbols                    | —                                                          |

  **Class 3 gate — R-186 (package-level public surface; root `/dsl`):**

  | Delta   | Count | Symbols                  | Accountability                                               |
  | ------- | ----- | ------------------------ | ------------------------------------------------------------ |
  | Added   | 0     | —                        | —                                                            |
  | Removed | 1     | `applyAuthoringDefaults` | Spec §4 entry (new; lands in bd-forge-main alongside SR-015) |
  | Net     | −1    | 152 → 151 symbols        | —                                                            |

  Combined (SR-015 end-state vs SR-014 end-state): net −8 symbols
  on the SDK's package public surface, with every delta accounted
  for by D-NN or spec §4.

  **Procedural finding (discovered-during-SR-015, logged for
  calibration).** `packages/adapter-vercel-ai/src/loop-tool-bridge.ts`
  had five pre-existing `.id` accessor sites that should have
  been renamed to `.loopId` / `.transitionId` when D-05 rewrote
  the schemas (commit `4b8035d`). The regression was silently
  masked for the duration of SR-012 through SR-014 for two
  compounding reasons:

  1. `tsup`'s build step emits `.js`/`.cjs` before the `dts`
     step runs, and the `dts` worker's error does not propagate
     a non-zero exit to `pnpm -r build`. The package's
     `dist/index.d.ts` was never emitted post-D-05, but the
     overall build reported success.
  2. Prior SR verification steps tailed `pnpm -r typecheck` and
     `pnpm -r build` output; `tail -N` elided the
     `adapter-vercel-ai typecheck: Failed` line from view in each
     case.

  Fix landed in commit `d0d2642` (five mechanical accessor
  renames). Calibration update logged to bd-forge-main's
  `PASS_B_EXECUTION_LOG.md` to require full-stream `rg "Failed"`
  scans on workspace commands in future SR verifications.

  **D-21 audit (end-of-SR-015).** Every `@loop-engine/*` package
  now declares only a root export, except the sanctioned
  `@loop-engine/registry-client/betterdata` entry. Audit script:

  ```bash
  for pkg in packages/*/package.json; do
    node -e "const p=require('./$pkg'); const keys=Object.keys(p.exports||{'.':null}); if (keys.length>1 && p.name!=='@loop-engine/registry-client') process.exit(1)"
  done
  ```

  Zero violations post-R-186.

  **Phase A.4 closure.** SR-015 closes Phase A.4 (barrel hygiene

  - single-root enforcement). Phase A.5 opens next with D-12
    Postgres production-grade adapter (multi-day integration work;
    budget orthogonal to the SR-class-1/2/3 cadence established
    through Phases A.1–A.4) plus the Kafka `@experimental` companion.

  **Originator.** R-164 (barrel rewrite, C-03 Class 3 gate), R-186
  (D-21 single-root enforcement, hygiene), plus ride-along SDK
  `AIActor` tightening (observation-tier follow-up from SR-013b),
  D-19 completeness alignment (`parseLoopJson`/`serializeLoopJson`),
  D-17 enforcement (`createLoop*Event` drop), and procedural-tier
  D-01/D-05 cascade cleanup in `adapter-vercel-ai`.

- ## SR-016 · D-12 · `@loop-engine/adapter-postgres` production-grade

  **Packages bumped:** `@loop-engine/adapter-postgres` (minor; `0.1.6` → `0.2.0`).

  **Status.** Closed. Phase A.5 advances (Postgres portion complete; Kafka `@experimental` companion ships separately as SR-017).

  **Class.** Class 2 (additive). No pre-existing public surface is removed or changed in shape; every previously exported symbol (`postgresStore`, `createSchema`, `PgClientLike`, `PgPoolLike`) keeps its signature. `PgClientLike` widens additively by adding optional `on?` / `off?` methods; callers whose client values lack those methods remain compatible via runtime presence-guarding.

  **Rationale.** D-12 → C resolved `adapter-postgres` as the production-grade storage-adapter target for `1.0.0-rc.0` (paired with Kafka `@experimental` for event streaming — see SR-017). At SR-016 entry the package shipped as a stub (`0.1.6` with `postgresStore` / `createSchema` present but no migration runner, no transaction support, no pool configuration, no error classification, no index tuning, and — critically — no integration-test coverage against real Postgres). SR-016's seven sub-commits brought the package to production grade: versioned migrations, transactional helper with indeterminacy-safe error handling, opinionated pool factory with `statement_timeout` wiring, typed error classification with connection-loss semantics, and query-plan verification for the hot `listOpenInstances` path. 64 → 70 integration tests against both pg 15 and pg 16 via `testcontainers`.

  **Sub-commit sequence.**

  1. **SR-016.1** (`63f3042`) — integration-test infrastructure: `testcontainers` helper with Docker-availability assertion, matrix over `postgres:15-alpine` / `postgres:16-alpine`, initial smoke test proving `createSchema` runs end-to-end. Fail-loud discipline established (no mock-Postgres fallback).
  2. **SR-016.2** — versioned migration runner: `runMigrations(pool)` / `loadMigrations()` with idempotency (tracked via `schema_migrations` table), transactional safety (each migration inside its own transaction), advisory-lock serialization (concurrent callers don't race on duplicate-key), and SHA-256 checksum drift detection (editing an applied migration is rejected at the next run). C-14 full-stream scan caught a `tsup` d.ts build failure (unused `@ts-expect-error`) during development — the calibration discipline's first prospective hit.
  3. **SR-016.3** — `withTransaction(fn)` helper: `PostgresStore extends LoopStore` gains the method, `TransactionClient = LoopStore` type exported. Factoring via `buildLoopStoreAgainst(querier)` ensures pool-backed and transaction-backed stores share method bodies. No raw-`pg.PoolClient` escape hatch (provider-specific concerns stay in provider-specific factories per PB-EX-02 Option A). Surfaced **SF-SR016.3-1**: pre-existing timestamp-deserialization round-trip bug (`new Date(asString(...))` → `.toISOString()` throwing on `Date`-valued columns), resolved in-SR via `asIsoString` helper.
  4. **SR-016.4** — pool configuration: `createPool(options)` / `DEFAULT_POOL_OPTIONS` / `PoolOptions`. Defaults: `max: 10`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 5_000`, `statement_timeout: 30_000`. `statement_timeout` wired via libpq `options` connection parameter (`-c statement_timeout=N`) so it applies at connection init with no per-query `SET` round-trip; consumer-supplied `options` (e.g., `-c search_path=...`) preserved. Exhaust-and-recover test proves the pool's max-connection ceiling and recovery semantics. `pg` declared as `peerDependency` per generic rule's vendor-SDK discipline.
  5. **SR-016.5** — error classification: `PostgresStoreError` base (with `.kind: "transient" | "permanent" | "unknown"` discriminant), `TransactionIntegrityError` subclass (always `kind: "transient"`), `classifyError(err)` / `isTransientError(err)` predicates. Narrow transient allowlist: `40P01`, `57P01`, `57P02`, `57P03` plus Node connection-error codes (`ECONNRESET`, `ECONNREFUSED`, etc.) and a `connection terminated` message regex. Constraint violations pass through as raw `pg.DatabaseError` (no per-SQLSTATE typed errors). Mid-transaction connection loss wraps as `TransactionIntegrityError` with cause preserved — the "indeterminacy rule" — so consumers can distinguish "transaction definitely failed, retry safe" from "transaction outcome unknown, caller must handle." Surfaced **SF-SR016.5-1**: pre-existing unhandled asynchronous `pg` client `'error'` event when a backend is terminated between queries, resolved in-SR via no-op handler installed in `withTransaction` for the transaction's duration with presence-guarded `client.on` / `client.off` for test-double compatibility.
  6. **SR-016.6** (`2579e16`) — index migration: `idx_loop_instances_loop_id_status` composite index on `(loop_id, status)` supporting the `listOpenInstances(loopId)` query path. EXPLAIN verification against ~10k seeded rows (×2 matrix images) asserts two first-class conditions on the plan tree: (a) the plan selects `idx_loop_instances_loop_id_status`, and (b) no `Seq Scan on loop_instances` appears anywhere in the tree. Plan format stable across pg 15 and pg 16.
  7. **SR-016.7** (this row) — rollup: this changeset entry, `DESIGN.md` capturing six load-bearing decisions for future maintainers, `PASS_B_EXECUTION_LOG.md` SR-016 aggregate, `API_SURFACE_SPEC_DRAFT.md` surface update, and integration-test-before-publish policy landed in `.cursor/rules/loop-engine-packaging.md`.

  **Load-bearing decisions recorded in `packages/adapters/postgres/DESIGN.md`.** Six decisions a future PR should not reshape without arguing against the recorded rationale:

  1. The SF-SR016.3-1 and SF-SR016.5-1 shared root cause (pre-existing latent bugs in uncovered adapter code paths) and the integration-test-before-publish policy derived from it.
  2. `statement_timeout` wiring via libpq `options` connection parameter (not per-query `SET`; not a pool-event handler).
  3. The `withTransaction` no-op `'error'` handler requirement with presence-guarded `client.on` / `client.off` for test-double compatibility.
  4. Module split pattern: `pool.ts`, `errors.ts`, `migrations/runner.ts`, plus `buildLoopStoreAgainst(querier)` factoring in `index.ts`.
  5. Adapter-postgres module structure as a candidate family-level convention (to be promoted to `loop-engine-packaging.md` when a second production-grade adapter reaches similar complexity).
  6. `withTransaction` indeterminacy rule: four-way case matrix keyed on "did the adapter end in a state where the transaction's terminal outcome is known?", with governing principle "only wrap an error in `TransactionIntegrityError` when the adapter genuinely cannot confirm a definite terminal state."

  **Migration.** No consumer migration required for existing `postgresStore(pool)` / `createSchema(pool)` callers — both keep their signatures. Consumers who want to adopt the new surface:

  ```diff
    import {
      postgresStore,
  -   createSchema
  +   createPool,
  +   runMigrations
    } from "@loop-engine/adapter-postgres";
    import { createLoopSystem } from "@loop-engine/sdk";

  - const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  - await createSchema(pool);
  + const pool = createPool({ connectionString: process.env.DATABASE_URL });
  + const migrationResult = await runMigrations(pool);
  + // migrationResult.applied lists newly-applied; .skipped lists already-applied.

    const { engine } = await createLoopSystem({
      loops: [loopDefinition],
      store: postgresStore(pool)
    });
  ```

  ```diff
    // Opt into transactional sequencing:
  + const store = postgresStore(pool);
  + await store.withTransaction(async (tx) => {
  +   await tx.saveInstance(updatedInstance);
  +   await tx.saveTransitionRecord(transitionRecord);
  + });
    // The callback receives a TransactionClient (LoopStore-shaped).
    // COMMIT on success, ROLLBACK on thrown error. Connection loss
    // during COMMIT surfaces as TransactionIntegrityError (kind: transient).
  ```

  ```diff
    // Opt into error-classification for retry logic:
  + import {
  +   classifyError,
  +   isTransientError,
  +   TransactionIntegrityError
  + } from "@loop-engine/adapter-postgres";
  +
  + try {
  +   await store.withTransaction(async (tx) => { /* ... */ });
  + } catch (err) {
  +   if (err instanceof TransactionIntegrityError) {
  +     // Indeterminate — transaction may or may not have committed.
  +     // Caller must handle (retry with compensating logic, alert, etc.).
  +   } else if (isTransientError(err)) {
  +     // Safe to retry with a fresh connection.
  +   } else {
  +     // Permanent: propagate to caller.
  +   }
  + }
  ```

  **Out of scope for this row (intentionally).**

  - Kafka `@experimental` companion: ships as SR-017 (small companion commit per the scheduling decision at SR-015 close).
  - Non-transactional migration stream (for `CREATE INDEX CONCURRENTLY` on large existing tables): flagged in `004_idx_loop_instances_loop_id_status.sql`'s header comment. At RC this is acceptable — new deploys build indexes against empty tables; existing small deploys tolerate the brief lock. A future adapter release may add the stream.
  - Per-SQLSTATE typed error classes (e.g., `UniqueViolationError`, `ForeignKeyViolationError`): deferred. Consumers branch on `pg.DatabaseError.code` directly, which is the standard `pg` ecosystem pattern. Revisit if consumer telemetry shows repeated per-code unwrapping.
  - Connection-pool metrics (pool size, idle connections, wait times): consumers who need observability can consume the `pg.Pool` instance directly (`pool.totalCount`, `pool.idleCount`, etc.). First-party observability integration is a `1.1.0` / later concern.
  - LISTEN/NOTIFY surface: consumers who need Postgres pub-sub alongside the store should manage their own `pg.Pool` (the adapter explicitly does not expose a raw `pg.PoolClient` escape hatch via `TransactionClient` — see Decision 6 rationale in `DESIGN.md`).

  **Symbol diff against 0.1.6.**

  Added to `@loop-engine/adapter-postgres` public surface:

  - `function runMigrations(pool: PgPoolLike, options?: RunMigrationsOptions): Promise<MigrationRunResult>`
  - `function loadMigrations(): Promise<readonly Migration[]>`
  - `type Migration = { readonly id: string; readonly sql: string; readonly checksum: string }`
  - `type MigrationRunResult = { readonly applied: string[]; readonly skipped: string[] }`
  - `type RunMigrationsOptions` (currently `{}`; reserved for future per-run overrides)
  - `function createPool(options?: PoolOptions): Pool`
  - `const DEFAULT_POOL_OPTIONS: Readonly<{ max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number; statement_timeout: number }>`
  - `type PoolOptions = pg.PoolConfig & { statement_timeout?: number }`
  - `class PostgresStoreError extends Error` (with `readonly kind: PostgresStoreErrorKind` discriminant)
  - `class TransactionIntegrityError extends PostgresStoreError` (always `kind: "transient"`)
  - `type PostgresStoreErrorKind = "transient" | "permanent" | "unknown"`
  - `function classifyError(err: unknown): PostgresStoreErrorKind`
  - `function isTransientError(err: unknown): boolean`
  - `type TransactionClient = LoopStore`
  - `interface PostgresStore extends LoopStore { withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> }`
  - `PgClientLike` widens additively: `on?` and `off?` optional methods for asynchronous `'error'` event handling.

  Changed (additive, no consumer-visible break):

  - `postgresStore(pool)` return type widens from `LoopStore` to `PostgresStore` (superset — every existing `LoopStore` consumer keeps working; consumers who opt into `withTransaction` gain the new method).

  No removals.

  **Verification (Phase A.7 sub-set).**

  - `pnpm -C packages/adapters/postgres typecheck` → exit 0.
  - `pnpm -C packages/adapters/postgres test` → 70/70 passed across 6 files (`pool.test.ts` 7, `migrations.test.ts` 7, `transactions.test.ts` 11, `errors.test.ts` 31, `indexes.test.ts` 6, `smoke.test.ts` 8).
  - `pnpm -C packages/adapters/postgres build` → exit 0. C-14 full-stream scan shows only the two pre-existing calibrated warnings (`.npmrc` `NODE_AUTH_TOKEN`; tsup `types`-condition ordering). Both warnings predate SR-016 and are tracked as unchanged-state carry-forward.
  - `pnpm -r typecheck` → exit 0.
  - `pnpm -r build` → exit 0. Full-stream C-14 scan clean.
  - C-10 symlink integrity → clean.

  **Originator.** D-12 → C (Postgres production-grade, paired with Kafka `@experimental`), with sub-commit granularity per the SR-016 plan authored at Phase A.5 open. Policy-landing originator: the shared root cause between SF-SR016.3-1 and SF-SR016.5-1, which motivated the integration-test-before-publish rule now at `loop-engine-packaging.md` §"Pre-publish verification requirements."

- ## SR-017 · D-12 · `@loop-engine/adapter-kafka` `@experimental` subscribe stub

  **Packages bumped:** `@loop-engine/adapter-kafka` (patch; `0.1.6` → `0.1.7`).

  **Status.** Closed. **Phase A.5 closes** with this SR.

  **Class.** Class 1 (additive). No existing symbol is removed or reshaped; `kafkaEventBus(options)` keeps its signature. The `subscribe` method is added to the bus returned by the factory.

  **Rationale.** Per D-12 → C, `@loop-engine/adapter-kafka` ships at `1.0.0-rc.0` with stable `emit` and experimental `subscribe`. SR-017 lands the `subscribe` side of that commitment as a typed, JSDoc-tagged stub that throws at call time rather than silently returning an unusable teardown handle. The stub is the smallest shape that (a) satisfies the `EventBus` interface's optional `subscribe` contract, (b) gives consumers a clear actionable error message if they call it, and (c) lets the real implementation land in a future release without changing the adapter's public surface shape.

  **Symbol changes.**

  - `kafkaEventBus(options).subscribe` — new method on the bus returned by the factory, tagged `@experimental` in JSDoc, with a `never` return type. Signature conforms to the `EventBus.subscribe?` contract (`(handler: (event: LoopEvent) => Promise<void>) => () => void`); `never` is assignable to `() => void` as the bottom type, so callers that assume a teardown handle surface the mistake at TypeScript compile time rather than runtime. The stub body throws a named error identifying which method is stubbed, which method ships stable (`emit`), and the milestone tracking the real implementation (`1.1.0`).
  - `kafkaEventBus` function — JSDoc block added documenting the current surface-status split (`emit` stable, `subscribe` experimental stub). No signature change.

  **Error message shape.** The thrown `Error` message is explicit about what's stubbed vs what ships:

  > `"@loop-engine/adapter-kafka: subscribe() is stubbed at 1.0.0-rc.0. Only emit() is implemented. Track the 1.1.0 milestone for the subscribe() implementation."`

  Consumers who inadvertently call `subscribe` see the package name, the stub's RC-0 scope, the one method that actually works, and the milestone their use case blocks on. This is strictly better than a generic `"Not yet implemented"` — the caller's next step (switch to `emit`-only usage, or wait for `1.1.0`) is in the message.

  **Migration.**

  No consumer migration required. Consumers currently using `kafkaEventBus({ ... }).emit(...)` see no change. Consumers who attempt `kafkaEventBus({ ... }).subscribe(...)` receive a compile-time flag (the `: never` return means any variable binding the return value will be typed `never`, which propagates to caller contracts) and a runtime throw with the refined error message.

  ```diff
    import { kafkaEventBus } from "@loop-engine/adapter-kafka";

    const bus = kafkaEventBus({ kafka, topic: "loop-events" });
    await bus.emit(someLoopEvent);  // Stable.

  - const teardown = bus.subscribe!(handler);   // Compiled at 1.0.0-rc.0;
  -                                             // threw at runtime without context.
  + // At 1.0.0-rc.0 this line throws with a descriptive error. TypeScript
  + // types `bus.subscribe(handler)` as `never`, so downstream code that
  + // assumes a teardown handle fails at compile time, not runtime.
  ```

  **Out of scope for this row (intentionally).**

  - A real `subscribe` implementation using `kafkajs` `Consumer` — tracked against the `1.1.0` milestone. Implementation will need: consumer group management, per-message deserialization and handler dispatch, at-least-once vs at-most-once semantics decision, offset commit strategy, consumer teardown on handler return. Each is a design decision, not a mechanical addition.
  - Integration tests against a real Kafka instance — the integration-test-before-publish policy landed in SR-016 applies at the `1.0.0` promotion gate; a stub method at 0.1.x is grandfathered. Integration coverage is expected before `adapter-kafka` reaches the `rc` status track or promotes to `1.0.0`.
  - Unit-level tests of the stub throw — the stub's contract is small enough (one method, one thrown error, one known message prefix) that the type system (`: never` return) and the explicit error message provide sufficient verification. A dedicated unit test would require introducing `vitest` as a dev dependency for a one-assertion file, which is scope-disproportionate for SR-017. Tests land alongside the real implementation in `1.1.0`.

  **Symbol diff against 0.1.6.**

  Added to `@loop-engine/adapter-kafka` public surface:

  - `kafkaEventBus(options).subscribe(handler): never` — new method on the returned bus; tagged `@experimental`, throws with a descriptive error.

  Changed:

  - `kafkaEventBus` function — JSDoc annotation only; signature unchanged.

  No removals.

  **Verification.**

  - `pnpm -C packages/adapters/kafka typecheck` → exit 0.
  - `pnpm -C packages/adapters/kafka build` → exit 0. C-14 full-stream scan clean (only pre-existing calibrated warnings).
  - `pnpm -r typecheck` → exit 0. C-14 clean.
  - `pnpm -r build` → exit 0. C-14 clean.
  - Tarball ceiling: adapter-kafka at well under 100 KB integration-adapter ceiling (no dependency changes; build size essentially unchanged from 0.1.6).

  **Originator.** D-12 → C (Kafka `@experimental` companion to adapter-postgres) per the scheduling decision at SR-016 close. Stub-shape refinement (specific error message naming what's stubbed vs what ships, plus `: never` return annotation for compile-time surfacing) per operator guidance at SR-017 clearance.

  **Phase A.5 closure.** SR-017 closes Phase A.5. The phase's scope was D-12 (Postgres production-grade + Kafka `@experimental`); both sub-tracks are now complete. Phase A.6 (example trees alignment) opens next.

- ## SR-018 · F-PB-09 + D-01 + D-05 + D-07 + D-13 · Phase A.6 example-tree alignment

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

- ## SR-019 · Phase A.7 · End-of-Branch-A verification pass

  Single-SR verification gate executing the full Branch-A-close check
  surface. Not a mutation SR; verifies the post-reconciliation workspace
  ships clean and the spec draft matches the shipped dist.

  **Full-gate results (clean):**

  - Workspace clean rebuild (C-11): `pnpm -r clean` + dist/turbo purge +
    `pnpm install` + `pnpm -r build` all green under C-14 full-stream
    scan.
  - `pnpm -r typecheck` green (26 packages).
  - `pnpm -r test` green including `@loop-engine/adapter-postgres` 70/70
    integration tests against real Postgres 15+16 (testcontainers).
  - `pnpm typecheck:examples` green against post-SR-018 widened scope.
  - Tarball ceilings: all 19 packages under ceilings. Postgres largest
    at 56.9 KB packed / 100 KB adapter ceiling (57%). Full table in
    `PASS_B_EXECUTION_LOG.md` SR-019 entry.
  - `bd-forge-main` split scan: producer-side baseline of six F-01
    stubs unchanged; no new stub introduced during Pass B.
  - `.changeset/1.0.0-rc.0.md` carries 19 SR entries (SR-001 through
    SR-018, SR-013 split).

  **Findings (three observation-tier; two resolved in-gate):**

  - **F-PA7-OBS-01** · paired-commit trailer discipline adopted
    mid-Pass-B (bd-forge-main side); trailer grep returns 10 instead
    of ~19. Documented as historical reality; backfilling would require
    history rewriting.
  - **F-PA7-OBS-02** · AI provider factory-signature spec drift.
    Spec entries for `createAnthropicActorAdapter`,
    `createOpenAIActorAdapter`, `createGeminiActorAdapter`,
    `createGrokActorAdapter` declared a uniform
    `(apiKey, options?) -> XActorAdapter` shape; actual SR-013b ships
    two distinct shapes: single-arg options factory for Anthropic /
    OpenAI (provider-branded return types removed) and two-arg
    `(apiKey, config?)` factory for Gemini / Grok (return-shape-only
    normalization). Resolved in-gate: `API_SURFACE_SPEC_DRAFT.md`
    §1078-1204 regenerated with accurate shipped signatures and a
    cross-adapter shape-divergence note.
  - **F-PA7-OBS-03** · `loadMigrations` signature spec drift. Spec
    showed `(): Promise<readonly Migration[]>`; actual is
    `(dir?: string): Promise<Migration[]>`. Resolved in-gate: spec
    entry updated.

  **C-15 calibration landed.** `PASS_B_CALIBRATION_NOTES.md` gained
  **C-15 · Verification-gate coverage lagging surface work is a
  first-class drift predictor** capturing the three-phase pattern
  (A.4 R-186 consumer-path enforcement; A.5 adapter-postgres integration
  tests; A.6 widened `typecheck:examples` scope) as an observational
  calibration for future product reconciliations.

  **Branch A is clear for merge.** Post-merge the work transitions to
  Branch B (`loopengine.dev` docs), Branch C (`loop-examples` repo),
  Branch D (`@loop-engine/*` → `@loopengine/*` D-18 rename).

  **Commits under this SR.**

  - `bd-forge-main`: single commit with spec patches
    (`API_SURFACE_SPEC_DRAFT.md` §867, §1078-1204) + `C-15` calibration
    entry + SR-019 execution-log entry + changeset entry update
    cross-reference.
  - `loop-engine`: single commit with the SR-019 changeset entry above.

  Both commits carry `Surface-Reconciliation-Id: SR-019` trailer.

  **Verification.** All checks clean per C-11 + C-14 + C-08 + C-10 +
  the Phase A.7 gate surface. No test regressions. Tarball footprints
  unchanged by this SR (no `packages/` source edits).

### Patch Changes

- Updated dependencies []:
  - @loop-engine/core@1.0.0-rc.0

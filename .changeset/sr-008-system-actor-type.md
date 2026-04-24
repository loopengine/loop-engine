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
## SR-008 — `feat(core): add system to ActorTypeSchema + ship SystemActor interface (D-03; MECHANICAL 8.9)`

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

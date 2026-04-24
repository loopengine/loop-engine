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
## SR-007 — `feat(core): rename isAuthorized to canActorExecuteTransition + add AIActorConstraints + pending_approval (D-08)`

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

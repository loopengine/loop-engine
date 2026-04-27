# Loop Engine Architecture

This document describes what is implemented today in `/packages` and `/loops`.
If a behavior is not in source, it is called out explicitly.

## Core concepts

### The Loop

A `LoopDefinition` (from `@loop-engine/core`) contains:

- `id`: stable loop identifier
- `version`: semver string (`x.y.z`)
- `description`: human-readable summary
- `domain`: domain label (`scm`, `crm`, etc.)
- `states`: list of `StateSpec`
- `initialState`: starting state id (must exist in `states`)
- `transitions`: list of `TransitionSpec`
- `outcome`: `OutcomeSpec` for measurable completion
- optional `participants`, `spawnableLoops`, `metadata`

Minimal YAML shape:

```yaml
id: example.procurement
version: 1.0.0
domain: scm
description: Minimal loop definition
states:
  - id: OPEN
  - id: SETTLED
    isTerminal: true
initialState: OPEN
transitions:
  - id: settle
    from: OPEN
    to: SETTLED
    allowedActors: [human, automation]
outcome:
  id: po_settled
  description: Purchase order settled
  valueUnit: po_settled
  measurable: true
```

### States and transitions

`StateSpec` fields:

- `id`: unique state id
- `isTerminal?`: marks lifecycle completion (`status` becomes `CLOSED` in runtime)
- `isError?`: marks error terminal path (`status` becomes `ERROR` in runtime)

`TransitionSpec` fields:

- `id`: transition id
- `from`: source state id
- `to`: destination state id
- `allowedActors`: allowed actor types
- optional `guards`, `sideEffects`, `description`

### The actor model

Actor types implemented in `@loop-engine/actors`:

1. `human`
2. `automation`
3. `ai-agent`
4. `webhook`
5. `system`

Every transition evaluation includes an actor, and runtime authorization is checked by
`canActorExecuteTransition(...)`.

Canonical `ActorRef` shape (`@loop-engine/core`):

```ts
type ActorRef = {
  type: "human" | "automation" | "ai-agent" | "webhook" | "system";
  id: string;
  displayName?: string;
  sessionId?: string;
  agentId?: string;
};
```

### Guards

`GuardSpec` fields:

- `id`
- `description`
- `failureMessage`
- `severity`: `hard` | `soft`
- `evaluatedBy`: `runtime` | `module` | `external`

Runtime behavior:

- `hard`: blocks transition, emits `loop.guard.failed`, state does not advance
- `soft`: transition proceeds; warning is appended to transition evidence as `_softGuardWarnings`

Built-in guards in `@loop-engine/guards`:

- `actor_has_permission` (`actorPermissionGuard`) - checks `evidence.required_role` vs `evidence.roles`
- `approval_obtained` (`approvalObtainedGuard`) - requires `evidence.approved === true`
- `deadline_not_exceeded` (`deadlineNotExceededGuard`) - validates `evidence.deadline_iso` is in the future
- `duplicate_check_passed` (`duplicateCheckPassedGuard`) - fails when `evidence.duplicate_found === true`
- `field_value_constraint` (`fieldValueConstraintGuard`) - evaluates `evidence.constraint` (`eq`, `gt`, `lt`, `in`)

### Events

Event types defined in `@loop-engine/events`:

- `loop.started`: emitted when `engine.start(...)` creates a new instance; includes `initialState`, `actor`
- `loop.transition.requested`: schema/type exists; runtime engine does not currently emit this event
- `loop.transition.executed`: emitted after successful transition persistence; includes `fromState`, `toState`, `transitionId`, `evidence`
- `loop.transition.blocked`: schema/type exists; runtime engine currently returns rejected status rather than emitting this event
- `loop.guard.failed`: emitted when a hard guard fails; includes `attemptedTransitionId`, `guardId`, `guardFailureMessage`
- `loop.completed`: emitted when transition enters terminal state (`isTerminal`); includes `terminalState`, `durationMs`, `transitionCount`, `outcomeId`, `valueUnit`
- `loop.error`: schema/type exists; current runtime does not emit this event
- `loop.spawned`: schema/type exists; current runtime does not emit this event
- `loop.signal.received`: schema/type exists; current runtime does not emit this event
- `loop.outcome.recorded`: schema/type exists; current runtime does not emit this event

### Learning signals

`LearningSignal` is implemented in `@loop-engine/events` and produced by
`extractLearningSignal(completedEvent, history, predicted?)`.

It contains:

- `predicted`: model or baseline estimate map
- `actual`: observed values map (currently computes `cycle_time_days` when history exists)
- `delta`: numeric difference (`actual - predicted`) for overlapping numeric keys

This is computed from completion event + transition history; it is not auto-emitted by runtime today.

## Package architecture

Verified from package dependencies:

```text
@loop-engine/sdk
  ├── @loop-engine/runtime
  │     ├── @loop-engine/core
  │     ├── @loop-engine/loop-definition
  │     ├── @loop-engine/events
  │     ├── @loop-engine/actors
  │     └── @loop-engine/guards
  ├── @loop-engine/loop-definition
  ├── @loop-engine/signals
  ├── @loop-engine/events
  ├── @loop-engine/observability
  ├── @loop-engine/core
  ├── @loop-engine/guards
  └── @loop-engine/adapter-memory (default store)
```

## Runtime lifecycle

`engine.transition(...)` execution path in `packages/runtime/src/engine.ts`:

1. Load instance from `store.getInstance(aggregateId)` and load definition from registry.
2. Reject if loop is closed/error (`state.isTerminal`, `state.isError`, or instance status).
3. Resolve transition by `(transitionId, from=currentState)`; reject with `invalid_transition` if not found.
4. Check actor authorization via `canActorExecuteTransition(...)`; may return `rejected` or `pending_approval`.
5. Evaluate guards through `guardEvaluator.evaluate(...)`, collecting hard/soft failures.
6. If hard guard fails, emit `loop.guard.failed` and return `guard_failed` without state advance.
7. Advance `currentState`, derive instance status (`IN_PROGRESS` / `CLOSED` / `ERROR`), persist transition record + instance.
8. Emit `loop.transition.executed`; if now `CLOSED`, emit `loop.completed`.
9. Run registered side-effect handlers for transition `sideEffects` ids.

Notes on implemented behavior:

- Soft guard failures are stored in transition evidence under `_softGuardWarnings`.
- `loop.transition.requested`, `loop.transition.blocked`, `loop.error`, `loop.spawned`,
  `loop.signal.received`, and `loop.outcome.recorded` are typed/schematized but not emitted by
  the current runtime implementation.

## Adapters

`LoopStore` interface (`@loop-engine/runtime`) requires:

- `getInstance(aggregateId)`
- `saveInstance(instance)`
- `getTransitionHistory(aggregateId)`
- `saveTransitionRecord(record)`
- `listOpenInstances(loopId, orgId)`

Available adapters in repo:

- `@loop-engine/adapter-memory` - complete in-memory `LoopStore` (used by default in SDK)
- `@loop-engine/adapter-postgres` - includes `createSchema(pool)` and `postgresStore(pool)` API; runtime methods are currently marked `pending`
- `@loop-engine/adapter-kafka` - `kafkaEventBus(...)` implementation for `EventBus`
- `@loop-engine/adapter-http` - `httpEventBus(...)` implementation for webhook emission

Default memory usage via SDK:

```ts
import { createLoopSystem } from "@loop-engine/sdk";

const { engine } = createLoopSystem({ loops: [definition] });
```

Postgres store wiring (current API surface):

```ts
import { createSchema, postgresStore } from "@loop-engine/adapter-postgres";
import { createLoopSystem } from "@loop-engine/sdk";

await createSchema(pool);
const { engine } = createLoopSystem({
  loops: [definition],
  store: postgresStore(pool)
});
```

The Postgres adapter methods currently throw `"postgresStore runtime implementation pending"` until completed.

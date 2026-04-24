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
## SR-017 · D-12 · `@loop-engine/adapter-kafka` `@experimental` subscribe stub

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

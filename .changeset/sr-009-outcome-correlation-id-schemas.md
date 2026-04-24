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
## SR-009 · D-02 · add `OutcomeIdSchema` + `CorrelationIdSchema`

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

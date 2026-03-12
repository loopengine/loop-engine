# Throw Audit Report (v0.1.0 Release Sign-off)

Scope: `packages/**.ts` (excluding `node_modules`, `dist`, `.d.ts`, `.test.ts`, `.spec.ts`)

| File | Line | Type | Message (truncated) | Classification | Notes |
|------|------|------|---------------------|----------------|-------|
| `packages/adapter-commerce-gateway/src/client/commerce-gateway-client.ts` | 64 | Error | `recordLoopOutcome is unavailable on this Commerce Gateway...` | `INTENTIONAL_VALIDATION` | Surfaces optional endpoint unavailability with actionable context. |
| `packages/adapter-commerce-gateway/src/client/commerce-gateway-client.ts` | 79 | Error | `Commerce Gateway request failed: ${status} ${statusText}` | `INTENTIONAL_VALIDATION` | HTTP failure propagation with status context. |
| `packages/adapter-commerce-gateway/src/actors/ai-procurement-actor.ts` | 26 | Error | `ActorContext.instance.data.sku is required` | `INTENTIONAL_VALIDATION` | Required actor input invariant. |
| `packages/adapter-commerce-gateway/src/actors/ai-procurement-actor.ts` | 68 | Error | `Claude response missing text block` | `INTENTIONAL_VALIDATION` | Provider response contract enforcement. |
| `packages/adapter-commerce-gateway/src/actors/ai-procurement-actor.ts` | 85 | Error | `OpenAI response missing content` | `INTENTIONAL_VALIDATION` | Provider response contract enforcement. |
| `packages/adapter-commerce-gateway/src/actors/ai-procurement-actor.ts` | 102 | Error | `Recommendation schema invalid` | `INTENTIONAL_VALIDATION` | Rejects malformed model output before evidence mapping. |
| `packages/adapter-commerce-gateway/src/actors/ai-pricing-actor.ts` | 12 | Error | `[loop-engine/adapter-commerce-gateway] buildPricingActor is not yet implemented...` | `INTENTIONAL_NOT_IMPLEMENTED` | Issue ref present: https://github.com/loopengine/loop-engine/issues |
| `packages/adapters/http/src/index.ts` | 36 | Error | `[@loop-engine/adapter-http] WebhookEventBus does not support subscribe...` | `INTENTIONAL_VALIDATION` | Explicitly enforces emit-only adapter contract; issue ref present for enhancements. |
| `packages/runtime/src/engine.ts` | 94 | Error | `loopId not found: ${options.loopId}` | `INTENTIONAL_VALIDATION` | Start-time registry invariant. |
| `packages/runtime/src/engine.ts` | 99 | Error | `OPEN instance already exists for aggregateId ${...}` | `INTENTIONAL_VALIDATION` | Prevents duplicate open loop instances. |
| `packages/runtime/src/engine.ts` | 133 | Error | `instance not found for ${options.aggregateId}` | `INTENTIONAL_VALIDATION` | Transition precondition enforcement. |
| `packages/runtime/src/engine.ts` | 137 | Error | `definition not found for ${instance.loopId}` | `INTENTIONAL_VALIDATION` | Runtime/registry consistency guard. |
| `packages/dsl/src/builder.ts` | 70 | Error | `transition ${spec.id} must have at least one actor` | `INTENTIONAL_VALIDATION` | DSL authoring invariant. |
| `packages/dsl/src/builder.ts` | 94 | Error | `outcome is required` | `INTENTIONAL_VALIDATION` | Required loop outcome invariant. |
| `packages/dsl/src/builder.ts` | 131 | Error | `validated.errors.join("; ")` | `INTENTIONAL_VALIDATION` | Aggregated schema validation failure. |
| `packages/registry-client/src/adapters/local.ts` | 115 | Error | `validated.errors.join("; ")` | `INTENTIONAL_VALIDATION` | Rejects invalid JSON loop definitions at ingest. |
| `packages/registry-client/src/adapters/http.ts` | 46 | Error | `Invalid loop definition from registry: ${...}` | `INTENTIONAL_VALIDATION` | Rejects invalid remote registry payloads. |

## Summary

- Total throws: **17**
- INTENTIONAL_VALIDATION: **16**
- INTENTIONAL_NOT_IMPLEMENTED: **1**
  - https://github.com/loopengine/loop-engine/issues
- UNEXPECTED: **0**

Release note: No generic-message throws, no silent placeholder returns, and no unclassified throw sites remain in audited scope.

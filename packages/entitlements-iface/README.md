# @loop-engine/entitlements-iface

Entitlements snapshot interface and self-host default implementation for the OSS Loop Engine runtime.

This package owns the entitlements seam that `@loop-engine/runtime-routes` (RT-20b) calls before mounting any RT-01 frozen-surface handler:

- `EntitlementsSnapshot` type
- `EntitlementsAdapter` interface
- `MemoryEntitlementsAdapter` — fixed tier-1 default for self-host
- `EntitlementsDeniedError` / `QuotaExceededError` sentinel errors (mapped to HTTP 403 / 429)
- `assertRuntimeAllowed(snapshot)` — coarse gate (tier ≥ 1)
- `transitionsPerMinuteForTier(tier)` — published tier ladder
- `recordTransitionWithinLimit(tenantId, snapshot, windows, now?)` — in-process sliding-window limiter

The proprietary hosted adapter — backed by the `EntitlementsSnapshot` MySQL table and per-pack tier inference — stays in `apps/hosted-loops` and never imports from `@repo/database` in OSS.

## Quick start

```ts
import {
  MemoryEntitlementsAdapter,
  assertRuntimeAllowed,
  recordTransitionWithinLimit,
} from "@loop-engine/entitlements-iface";

const adapter = new MemoryEntitlementsAdapter();
const snap = await adapter.getEntitlements("default");
assertRuntimeAllowed(snap);

const windows = new Map<string, number[]>();
recordTransitionWithinLimit("default", snap, windows);
```

## License

Apache-2.0. See [LICENSE](./LICENSE).

# @loop-engine/auth-iface

Authentication interface, bearer extraction, and API-key helpers for the OSS Loop Engine self-host runtime.

This package owns the small, hosting-agnostic auth primitives:

- `extractBearerToken(header)` / `extractBearerTokenFromRequest(req)` — parse `Authorization: Bearer …`
- `generatePlainLoopApiKey()` / `hashLoopApiKey(plain)` / `keyPrefixDisplay(plain)` / `isLoopEngineApiKeyToken(token)` / `normalizeLoopApiKeyToken(token)` — `le_*` shape + SHA-256 hashing
- `AuthAdapter` interface — turns a `Request` into a `RuntimeIdentity`
- `MemoryAuthAdapter` — in-memory implementation for tests and trivial deployments
- `AuthenticationError` — sentinel error mapped to HTTP 401 by `@loop-engine/runtime-routes`

The DB-backed adapter (resolving `le_*` against `LoopEngineApiKey` rows in `@loop-engine/runtime-db`) ships in `@loop-engine/runtime-core` (RT-20b). The hosted/cloud adapter (JWT + tenant context + billing) stays proprietary in `apps/hosted-loops`.

## Quick start

```ts
import {
  MemoryAuthAdapter,
  generatePlainLoopApiKey,
  hashLoopApiKey,
} from "@loop-engine/auth-iface";

const token = generatePlainLoopApiKey();
const adapter = new MemoryAuthAdapter([
  { token, tenantId: "default", apiKeyId: "key_demo" },
]);

const identity = await adapter.authenticate(
  new Request("https://example.com", { headers: { authorization: `Bearer ${token}` } }),
);
// → { tenantId: "default", apiKeyId: "key_demo", actorId: "le_key:key_demo", role: "API_KEY", source: "api" }
```

## License

Apache-2.0. See [LICENSE](./LICENSE).

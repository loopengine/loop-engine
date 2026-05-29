// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * Resolved identity for a Loop Engine runtime request.
 *
 * `tenantId` is the only mandatory field; in self-host single-tenant mode this
 * is the constant `"default"` tenant ID. `apiKeyId` and `actorId` are populated
 * when an API key was used; richer fields (role, actor type) stay optional so
 * the cloud build can extend the same shape.
 */
export type RuntimeIdentity = {
  tenantId: string;
  apiKeyId: string | null;
  actorId: string;
  role: string;
  source: "api" | "ui" | "internal";
};

/**
 * `AuthAdapter` is the integration seam used by `@loop-engine/runtime-routes`
 * to turn an inbound HTTP request into a `RuntimeIdentity`. It MUST throw an
 * `Error` (the runtime will map it to a 401) when authentication fails.
 *
 * Implementations:
 *  - `MemoryAuthAdapter` — in-memory token table (this package; useful for tests + trivial deployments).
 *  - DB-backed adapter — lives in `@loop-engine/runtime-core` (RT-20b) and resolves keys via `@loop-engine/runtime-db`.
 *  - Hosted/cloud adapter — proprietary; stays in `apps/hosted-loops`.
 */
export interface AuthAdapter {
  authenticate(request: Request): Promise<RuntimeIdentity>;
}

/** Sentinel error thrown by adapters when authentication fails. */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

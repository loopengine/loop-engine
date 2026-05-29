// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/auth-iface` — auth integration seam for the OSS Loop Engine runtime.
 *
 * Pure functions for bearer extraction + API-key shape, plus the `AuthAdapter`
 * interface that `@loop-engine/runtime-routes` (RT-20b) calls before invoking a
 * handler. A `MemoryAuthAdapter` is included for tests and trivial deployments;
 * production deployments swap in the DB-backed adapter from
 * `@loop-engine/runtime-core` (RT-20b) or the proprietary hosted adapter.
 */
export { extractBearerToken, extractBearerTokenFromRequest } from "./bearer.js";
export {
  LOOP_ENGINE_API_KEY_PREFIX,
  isLoopEngineApiKeyToken,
  normalizeLoopApiKeyToken,
  generatePlainLoopApiKey,
  hashLoopApiKey,
  keyPrefixDisplay,
} from "./api-key.js";
export type { AuthAdapter, RuntimeIdentity } from "./types.js";
export { AuthenticationError } from "./types.js";
export { MemoryAuthAdapter, type MemoryApiKeyRecord } from "./memory-adapter.js";

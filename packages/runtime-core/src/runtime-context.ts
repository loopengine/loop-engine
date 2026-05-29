// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { AuthAdapter } from "@loop-engine/auth-iface";
import type { EntitlementsAdapter } from "@loop-engine/entitlements-iface";

import type { TraceReadRepository } from "./trace-repository.js";

/**
 * Injection point handed to every route handler factory in
 * `@loop-engine/runtime-routes`. Tests pass in-memory adapters; the OSS app
 * constructs a singleton against the real `runtime-db` + `MemoryEntitlementsAdapter`
 * + `DbAuthAdapter`; the hosted-loops cloud build keeps its own context built
 * against the proprietary entitlements DB.
 *
 * Trace writes are not handed a store on the context — write-side code paths
 * construct an `OssPostgresTraceStore(identity.tenantId, traceRepository)`
 * per-request so that the store's tenant scope always matches the authenticated
 * identity (RT-20-review F-2: kill the default-tenant trace bleed).
 */
export interface RuntimeContext {
  /** Authentication seam — resolves a `Request` to a `RuntimeIdentity` (tenant + apiKey id). */
  authAdapter: AuthAdapter;
  /** Entitlements seam — resolves a `tenantId` to a snapshot used by quota helpers. */
  entitlementsAdapter: EntitlementsAdapter;
  /** Repository for run summary + trace reads that back the RT-05 routes. */
  traceRepository: TraceReadRepository;
  /**
   * RT-01 frozen contract: trace routes return 503 when `LOOP_TRACE_ENABLED !== "true"`.
   * `apps/loop-engine-runtime` defaults this to `true`; tests can set it to `false`
   * to exercise the gate.
   */
  traceReadEnabled: boolean;
}

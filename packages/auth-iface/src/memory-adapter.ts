// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { extractBearerTokenFromRequest } from "./bearer.js";
import { isLoopEngineApiKeyToken, normalizeLoopApiKeyToken } from "./api-key.js";
import { type AuthAdapter, AuthenticationError, type RuntimeIdentity } from "./types.js";

export type MemoryApiKeyRecord = {
  /** Plain `le_*` token. Hashed internally; never persisted in production deployments. */
  token: string;
  tenantId: string;
  apiKeyId: string;
  actorId?: string;
};

/**
 * In-memory `AuthAdapter` keyed on the normalized plain token. Intended for
 * tests, fixtures, and trivial single-key deployments. Production deployments
 * should use the DB-backed adapter from `@loop-engine/runtime-core` (RT-20b)
 * which validates against the `LoopEngineApiKey` table in `@loop-engine/runtime-db`.
 */
export class MemoryAuthAdapter implements AuthAdapter {
  private readonly byToken = new Map<string, MemoryApiKeyRecord>();

  constructor(records: ReadonlyArray<MemoryApiKeyRecord> = []) {
    for (const rec of records) {
      this.register(rec);
    }
  }

  register(record: MemoryApiKeyRecord): void {
    if (!isLoopEngineApiKeyToken(record.token)) {
      throw new Error(
        `MemoryAuthAdapter.register: token "${record.token}" is not a valid le_* API key`,
      );
    }
    this.byToken.set(normalizeLoopApiKeyToken(record.token), record);
  }

  async authenticate(request: Request): Promise<RuntimeIdentity> {
    const token = extractBearerTokenFromRequest(request);
    if (!token) {
      throw new AuthenticationError("Missing or malformed Authorization header");
    }
    if (!isLoopEngineApiKeyToken(token)) {
      throw new AuthenticationError("Token is not a Loop Engine API key");
    }
    const record = this.byToken.get(normalizeLoopApiKeyToken(token));
    if (!record) {
      throw new AuthenticationError("Invalid or expired API key");
    }
    return {
      tenantId: record.tenantId,
      apiKeyId: record.apiKeyId,
      actorId: record.actorId ?? `le_key:${record.apiKeyId}`,
      role: "API_KEY",
      source: "api",
    };
  }
}

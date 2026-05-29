// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import {
  type AuthAdapter,
  AuthenticationError,
  type RuntimeIdentity,
  extractBearerTokenFromRequest,
  hashLoopApiKey,
  isLoopEngineApiKeyToken,
  normalizeLoopApiKeyToken,
} from "@loop-engine/auth-iface";
import type { LoopEngineApiKey, PrismaClient } from "@loop-engine/runtime-db";

/**
 * DB-backed `AuthAdapter` for the OSS Loop Engine runtime. Validates `le_*`
 * tokens against the `LoopEngineApiKey` table in `@loop-engine/runtime-db`,
 * honoring the 24h rotation grace window per Decision 6 (see
 * `apps/hosted-loops/lib/loop-engine-api-key.ts` for the upstream impl).
 *
 * Throws `AuthenticationError` on miss; the runtime-routes middleware maps it
 * to HTTP 401.
 */
export class DbAuthAdapter implements AuthAdapter {
  constructor(private readonly db: PrismaClient) {}

  async authenticate(request: Request): Promise<RuntimeIdentity> {
    const token = extractBearerTokenFromRequest(request);
    if (!token) {
      throw new AuthenticationError("Missing or malformed Authorization header");
    }
    if (!isLoopEngineApiKeyToken(token)) {
      throw new AuthenticationError("Token is not a Loop Engine API key");
    }

    const hashed = hashLoopApiKey(normalizeLoopApiKeyToken(token));
    const now = new Date();

    const byPrimary = await this.db.loopEngineApiKey.findFirst({
      where: { status: "ACTIVE", keyHash: hashed },
    });
    if (byPrimary) {
      await this.clearExpiredGraceIfNeeded(byPrimary);
      await this.touchLastUsed(byPrimary.id, now);
      return identityFromRow(byPrimary);
    }

    const byGrace = await this.db.loopEngineApiKey.findFirst({
      where: {
        status: "ACTIVE",
        graceKeyHash: hashed,
        graceExpiresAt: { gt: now },
      },
    });
    if (!byGrace) {
      throw new AuthenticationError("Invalid or expired API key");
    }
    await this.touchLastUsed(byGrace.id, now);
    return identityFromRow(byGrace);
  }

  private async clearExpiredGraceIfNeeded(row: LoopEngineApiKey): Promise<void> {
    if (!row.graceExpiresAt || row.graceExpiresAt.getTime() > Date.now()) return;
    if (!row.graceKeyHash) return;
    await this.db.loopEngineApiKey.update({
      where: { id: row.id },
      data: { graceKeyHash: null, graceExpiresAt: null },
    });
  }

  private async touchLastUsed(keyId: string, when: Date): Promise<void> {
    await this.db.loopEngineApiKey
      .update({ where: { id: keyId }, data: { lastUsedAt: when } })
      .catch(() => undefined);
  }
}

function identityFromRow(row: LoopEngineApiKey): RuntimeIdentity {
  return {
    tenantId: row.tenantId,
    apiKeyId: row.id,
    actorId: `le_key:${row.id}`,
    role: "API_KEY",
    source: "api",
  };
}

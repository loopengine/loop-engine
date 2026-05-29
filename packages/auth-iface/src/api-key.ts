// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { createHash, randomBytes } from "node:crypto";

/**
 * Canonical Loop Engine API-key shape: `le_` + 32 hex chars (16 random bytes).
 * The canonical form is lowercase at generation; verification normalizes case
 * before hashing so a token captured in mixed case still matches.
 */
export const LOOP_ENGINE_API_KEY_PREFIX = "le_";

const LE_HEX_BODY = /^le_[0-9a-f]{32}$/i;

/** True if `token` syntactically looks like a Loop Engine `le_*` API key. */
export function isLoopEngineApiKeyToken(token: string): boolean {
  return LE_HEX_BODY.test(token.trim());
}

/** Normalize a presented token for hashing (trim + lowercase). */
export function normalizeLoopApiKeyToken(token: string): string {
  return token.trim().toLowerCase();
}

/** Generate a fresh plain key (`le_` + 32 lowercase hex chars). */
export function generatePlainLoopApiKey(): string {
  const hex = randomBytes(16).toString("hex");
  return `${LOOP_ENGINE_API_KEY_PREFIX}${hex}`;
}

/** Compute the SHA-256 hex digest used for `LoopEngineApiKey.keyHash`. */
export function hashLoopApiKey(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/** Redacted display handle stored alongside the hash (`le_abcd1234...`). */
export function keyPrefixDisplay(plain: string): string {
  return `${plain.slice(0, 12)}...`;
}

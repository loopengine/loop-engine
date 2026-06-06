// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";

import {
  generatePlainLoopApiKey,
  hashLoopApiKey,
  isLoopEngineApiKeyToken,
  keyPrefixDisplay,
  LOOP_ENGINE_API_KEY_PREFIX,
  normalizeLoopApiKeyToken,
} from "../api-key.js";

describe("isLoopEngineApiKeyToken", () => {
  it("accepts canonical lowercase tokens", () => {
    expect(isLoopEngineApiKeyToken("le_0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("accepts uppercase hex (case-insensitive)", () => {
    expect(isLoopEngineApiKeyToken("le_0123456789ABCDEF0123456789ABCDEF")).toBe(true);
  });

  it("rejects unknown prefixes", () => {
    expect(isLoopEngineApiKeyToken("sk_0123456789abcdef0123456789abcdef")).toBe(false);
  });

  it("rejects short/long tokens", () => {
    expect(isLoopEngineApiKeyToken("le_0123")).toBe(false);
    expect(isLoopEngineApiKeyToken("le_0123456789abcdef0123456789abcdef0")).toBe(false);
  });

  it("rejects non-hex bodies", () => {
    expect(isLoopEngineApiKeyToken("le_0123456789abcdef0123456789abcdez")).toBe(false);
  });
});

describe("normalizeLoopApiKeyToken", () => {
  it("trims and lowercases", () => {
    expect(normalizeLoopApiKeyToken("  LE_AbC123  ")).toBe("le_abc123");
  });
});

describe("generatePlainLoopApiKey", () => {
  it("produces canonical-shaped tokens", () => {
    const key = generatePlainLoopApiKey();
    expect(key.startsWith(LOOP_ENGINE_API_KEY_PREFIX)).toBe(true);
    expect(isLoopEngineApiKeyToken(key)).toBe(true);
  });

  it("produces distinct values", () => {
    const a = generatePlainLoopApiKey();
    const b = generatePlainLoopApiKey();
    expect(a).not.toBe(b);
  });
});

describe("hashLoopApiKey", () => {
  it("returns a stable SHA-256 hex digest", () => {
    const known = hashLoopApiKey("le_0123456789abcdef0123456789abcdef");
    expect(known).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLoopApiKey("le_0123456789abcdef0123456789abcdef")).toBe(known);
  });

  it("produces a different hash for a different input", () => {
    expect(hashLoopApiKey("le_0000000000000000000000000000000a")).not.toBe(
      hashLoopApiKey("le_0000000000000000000000000000000b"),
    );
  });
});

describe("keyPrefixDisplay", () => {
  it("returns the first 12 chars with an ellipsis", () => {
    expect(keyPrefixDisplay("le_0123456789abcdef0123456789abcdef")).toBe("le_012345678...");
  });
});

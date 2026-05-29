import { describe, expect, it } from "vitest";

import { AuthenticationError, MemoryAuthAdapter } from "../index.js";

const VALID_TOKEN = "le_0123456789abcdef0123456789abcdef";
const OTHER_TOKEN = "le_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function authedRequest(token: string): Request {
  return new Request("https://example.com", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("MemoryAuthAdapter", () => {
  it("authenticates a registered token", async () => {
    const adapter = new MemoryAuthAdapter([
      { token: VALID_TOKEN, tenantId: "default", apiKeyId: "key_1" },
    ]);
    const identity = await adapter.authenticate(authedRequest(VALID_TOKEN));
    expect(identity).toEqual({
      tenantId: "default",
      apiKeyId: "key_1",
      actorId: "le_key:key_1",
      role: "API_KEY",
      source: "api",
    });
  });

  it("normalizes case before lookup", async () => {
    const adapter = new MemoryAuthAdapter([
      { token: VALID_TOKEN, tenantId: "default", apiKeyId: "key_1" },
    ]);
    const identity = await adapter.authenticate(authedRequest(VALID_TOKEN.toUpperCase()));
    expect(identity.apiKeyId).toBe("key_1");
  });

  it("rejects when Authorization header is missing", async () => {
    const adapter = new MemoryAuthAdapter();
    await expect(adapter.authenticate(new Request("https://example.com"))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("rejects when token does not match the le_* shape", async () => {
    const adapter = new MemoryAuthAdapter();
    await expect(adapter.authenticate(authedRequest("sk_abc"))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("rejects when token is well-formed but unknown", async () => {
    const adapter = new MemoryAuthAdapter([
      { token: VALID_TOKEN, tenantId: "default", apiKeyId: "key_1" },
    ]);
    await expect(adapter.authenticate(authedRequest(OTHER_TOKEN))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("refuses to register a malformed token", () => {
    expect(() => new MemoryAuthAdapter([{ token: "sk_bad", tenantId: "x", apiKeyId: "y" }]))
      .toThrowError();
  });
});

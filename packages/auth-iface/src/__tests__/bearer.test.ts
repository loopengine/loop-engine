import { describe, expect, it } from "vitest";

import { extractBearerToken, extractBearerTokenFromRequest } from "../bearer.js";

describe("extractBearerToken", () => {
  it("returns the token from a well-formed Bearer header", () => {
    expect(extractBearerToken("Bearer le_abcd")).toBe("le_abcd");
  });

  it("returns null for null/undefined/empty input", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
  });

  it("returns null for non-Bearer schemes", () => {
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken("bearer le_abcd")).toBeNull();
  });

  it("returns null for a Bearer header with no token", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearer    ")).toBeNull();
  });

  it("trims trailing whitespace around the token", () => {
    expect(extractBearerToken("Bearer le_abcd  ")).toBe("le_abcd");
  });
});

describe("extractBearerTokenFromRequest", () => {
  it("pulls authorization off a Request and returns the token", () => {
    const req = new Request("https://example.com", {
      headers: { authorization: "Bearer le_xyz" },
    });
    expect(extractBearerTokenFromRequest(req)).toBe("le_xyz");
  });

  it("returns null when no authorization header is present", () => {
    const req = new Request("https://example.com");
    expect(extractBearerTokenFromRequest(req)).toBeNull();
  });
});

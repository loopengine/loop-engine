// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from "vitest";
import { betterDataRegistry } from "../adapters/betterdata";

const sampleLoop = {
  id: "demo.loop",
  version: "1.0.0",
  name: "demo.loop",
  description: "Demo loop",
  states: [
    { id: "OPEN", label: "Open" },
    { id: "DONE", label: "Done", isTerminal: true },
  ],
  initialState: "OPEN",
  transitions: [
    {
      id: "finish",
      from: "OPEN",
      to: "DONE",
      signal: "demo.finish",
      actors: ["human"],
    },
  ],
  outcome: {
    description: "Done",
    valueUnit: "done",
    businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }],
  },
};

function v0ListAndArtifactMocks() {
  return vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "demo.loop",
              latestVersion: "1.0.0",
              latestStableVersion: "1.0.0",
              domain: "demo",
            },
          ],
          nextCursor: null,
        }),
        { status: 200 }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "demo.loop",
          version: "1.0.0",
          definition: sampleLoop,
          manifest: {},
          integrity: { sha256: "x", signature: null, signatureKeyId: null },
          publishedAt: new Date().toISOString(),
        }),
        { status: 200 }
      )
    );
}

describe("betterDataRegistry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should construct the correct production v0 URL", async () => {
    const fetchMock = v0ListAndArtifactMocks();
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "key", orgId: "org-1" });
    await registry.list();

    expect(fetchMock.mock.calls[0]?.[0]).toContain("https://registry.betterdata.co/v0/loops");
  });

  it("should construct the correct staging v0 URL", async () => {
    const fetchMock = v0ListAndArtifactMocks();
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "key", orgId: "org-1", env: "staging" });
    await registry.list();

    expect(fetchMock.mock.calls[0]?.[0]).toContain("https://registry-staging.betterdata.co/v0/loops");
  });

  it("should send Authorization header on every request", async () => {
    const fetchMock = v0ListAndArtifactMocks();
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "secret", orgId: "org-1" });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      })
    );
  });

  it("should send X-BD-Org-Id header on every request", async () => {
    const fetchMock = v0ListAndArtifactMocks();
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "secret", orgId: "org-42" });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-BD-Org-Id": "org-42",
        }),
      })
    );
  });

  it("should use 5 minute cache TTL by default", async () => {
    vi.useFakeTimers();
    const fetchMock = v0ListAndArtifactMocks();
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "secret", orgId: "org-1" });
    await registry.list();
    await registry.list();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("should be importable from @loop-engine/registry-client/betterdata subpath", async () => {
    const mod = await import("../../betterdata");
    expect(typeof mod.betterDataRegistry).toBe("function");
  });
});

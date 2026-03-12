// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from "vitest";
import { betterDataRegistry } from "../adapters/betterdata";

const sampleLoop = {
  id: "demo.loop",
  version: "1.0.0",
  description: "Demo loop",
  domain: "demo",
  states: [{ id: "OPEN" }, { id: "DONE", isTerminal: true }],
  initialState: "OPEN",
  transitions: [{ id: "finish", from: "OPEN", to: "DONE", allowedActors: ["human"] }],
  outcome: {
    id: "done",
    description: "Done",
    valueUnit: "done",
    measurable: true
  }
};

describe("betterDataRegistry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should construct the correct production URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "key", orgId: "org-1" });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://registry.betterdata.co/loops",
      expect.any(Object)
    );
  });

  it("should construct the correct staging URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "key", orgId: "org-1", env: "staging" });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://registry-staging.betterdata.co/loops",
      expect.any(Object)
    );
  });

  it("should send Authorization header on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "secret", orgId: "org-1" });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret"
        })
      })
    );
  });

  it("should send X-BD-Org-Id header on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "secret", orgId: "org-42" });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-BD-Org-Id": "org-42"
        })
      })
    );
  });

  it("should use 5 minute cache TTL by default", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = betterDataRegistry({ apiKey: "secret", orgId: "org-1" });
    await registry.list();
    await registry.list();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("should be importable from @loop-engine/registry-client/betterdata subpath", async () => {
    const mod = await import("../../betterdata");
    expect(typeof mod.betterDataRegistry).toBe("function");
  });
});

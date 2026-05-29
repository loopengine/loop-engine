// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from "vitest";
import { v0Registry } from "../adapters/v0";
import { RegistryNetworkError } from "../types";

const asLoopId = (id: string) => id as never;

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

function v0Summary(loopId: string) {
  return {
    id: loopId,
    latestVersion: "1.0.0",
    latestStableVersion: "1.0.0",
    domain: "demo",
    title: loopId,
    description: "",
    tags: [],
    maintainers: [],
    status: "active",
    publishedAt: new Date().toISOString(),
  };
}

function v0Artifact(loopId: string) {
  return {
    id: loopId,
    version: "1.0.0",
    definition: sampleLoop,
    manifest: { title: loopId },
    integrity: { sha256: "abc", signature: null, signatureKeyId: null },
    publishedAt: new Date().toISOString(),
  };
}

describe("v0Registry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /v0/loops/{id}?channel=stable then artifact fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            loop: v0Summary("demo.loop"),
            recommendedVersion: "1.0.0",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(v0Artifact("demo.loop")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "http://localhost:3011" });
    const found = await registry.get(asLoopId("demo.loop"));

    expect(found?.id).toBe(asLoopId("demo.loop"));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3011/v0/loops/demo.loop?channel=stable"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://localhost:3011/v0/loops/demo.loop/versions/1.0.0"
    );
  });

  it("returns null on loop 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "http://localhost:3011" });
    const found = await registry.get(asLoopId("missing.loop"));

    expect(found).toBeNull();
  });

  it("lists via paginated GET /v0/loops", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [v0Summary("demo.loop")],
            nextCursor: null,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(v0Artifact("demo.loop")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "https://registry.loopengine.dev" });
    const listed = await registry.list();

    expect(listed).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/v0/loops");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("limit=100");
  });

  it("getVersion fetches artifact path directly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(v0Artifact("demo.loop")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "http://localhost:3011" });
    const found = await registry.getVersion(asLoopId("demo.loop"), "1.0.0");

    expect(found?.version).toBe("1.0.0");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3011/v0/loops/demo.loop/versions/1.0.0",
      expect.any(Object)
    );
  });

  it("strips /loops and /v0 suffixes from baseUrl", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            loop: v0Summary("demo.loop"),
            recommendedVersion: "1.0.0",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(v0Artifact("demo.loop")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "http://localhost:3011/v0/loops" });
    await registry.get(asLoopId("demo.loop"));

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3011/v0/loops/demo.loop?channel=stable"
    );
  });

  it("register() is not supported on read-only v0 adapter", async () => {
    const registry = v0Registry({ baseUrl: "http://localhost:3011" });
    await expect(registry.register(sampleLoop as never)).rejects.toThrow(/does not support register/);
  });

  it("throws RegistryNetworkError when list payload is not paginated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = v0Registry({ baseUrl: "http://localhost:3011" });
    await expect(registry.list()).rejects.toBeInstanceOf(RegistryNetworkError);
  });
});

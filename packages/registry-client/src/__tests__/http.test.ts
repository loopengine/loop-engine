// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from "vitest";
import { loopId } from "@loop-engine/core";
import { httpRegistry } from "../adapters/http";
import { RegistryConflictError, RegistryNetworkError } from "../types";

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

describe("httpRegistry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should fetch a loop definition by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(sampleLoop), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001" });
    const found = await registry.get(loopId("demo.loop"));

    expect(found?.id).toBe(loopId("demo.loop"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should return null on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001" });
    const found = await registry.get(loopId("demo.loop"));

    expect(found).toBeNull();
  });

  it("should list all definitions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001" });
    const listed = await registry.list();

    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(loopId("demo.loop"));
  });

  it("should send custom headers on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({
      baseUrl: "http://localhost:3001",
      headers: { Authorization: "Bearer token" }
    });
    await registry.list();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/loops",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" })
      })
    );
  });

  it("should retry on network error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleLoop), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001", retries: 1 });
    const promise = registry.get(loopId("demo.loop"));
    await vi.advanceTimersByTimeAsync(250);
    const found = await promise;

    expect(found?.id).toBe(loopId("demo.loop"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should not retry on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001", retries: 3 });
    const found = await registry.get(loopId("unknown.loop"));

    expect(found).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should throw RegistryNetworkError after retries exhausted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network"));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001", retries: 1 });
    const promise = expect(registry.list()).rejects.toBeInstanceOf(RegistryNetworkError);
    await vi.advanceTimersByTimeAsync(500);
    await promise;
  });

  it("should return cached list results within TTL", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001", cacheTtlMs: 1_000 });
    await registry.list();
    await registry.list();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should re-fetch after TTL expires", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify([sampleLoop]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001", cacheTtlMs: 1_000 });
    await registry.list();
    await vi.advanceTimersByTimeAsync(1_100);
    await registry.list();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should register a definition via POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001" });
    await registry.register(sampleLoop as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/loops",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" })
      })
    );
  });

  it("should throw RegistryConflictError on 409", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const registry = httpRegistry({ baseUrl: "http://localhost:3001" });
    await expect(registry.register(sampleLoop as never)).rejects.toBeInstanceOf(RegistryConflictError);
  });
});

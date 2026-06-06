// Copyright (c) Better Data, Inc. and contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import type { LoopEvent } from "@loop-engine/events";
import { createLoopStatusClient, cursorOf } from "../client.js";
import { parseSseFrame } from "../sse.js";

function transition(id: string): LoopEvent {
  return {
    type: "loop.transition.executed",
    eventId: `evt_${id}`,
    loopId: "scm.demand-forecast",
    aggregateId: `inst_${id}`,
    orgId: "org_1",
    occurredAt: "2026-06-06T00:00:00.000Z",
    correlationId: `corr_${id}`,
    schemaVersion: "1.0",
    fromState: "OPEN",
    toState: "CLOSED",
    transitionId: "close",
    actor: { actorId: "system:loop-state-sync", actorType: "system" },
    evidence: { source: "loop-state-sync", transition_event_id: id },
  };
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("parseSseFrame", () => {
  it("parses event + data with optional leading space", () => {
    expect(parseSseFrame("event: ping\ndata: {\"a\":1}")).toEqual({ event: "ping", data: '{"a":1}' });
  });
  it("joins multiple data lines and ignores comments", () => {
    expect(parseSseFrame(": keepalive\ndata: a\ndata: b")).toEqual({ event: "message", data: "a\nb" });
  });
  it("returns null for a data-less frame", () => {
    expect(parseSseFrame("event: x")).toBeNull();
  });
});

describe("cursorOf", () => {
  it("extracts evidence.transition_event_id", () => {
    expect(cursorOf(transition("c123"))).toBe("c123");
  });
});

describe("pullTransitions", () => {
  it("sends org/since/limit + bearer and parses the page", async () => {
    let capturedUrl: URL | undefined;
    let capturedAuth: string | undefined;
    const fetchMock = (async (url: URL | RequestInfo, init?: RequestInit) => {
      capturedUrl = url as URL;
      capturedAuth = (init?.headers as Record<string, string>).authorization;
      return new Response(
        JSON.stringify({ events: [transition("1")], nextCursor: "1", hasMore: false }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = createLoopStatusClient({
      baseUrl: "https://cloud.example/",
      getToken: () => "tok123",
      fetch: fetchMock,
    });

    const page = await client.pullTransitions({ organizationId: "org_1", since: "0", limit: 50 });

    expect(capturedUrl?.pathname).toBe("/api/v1/loop-state/transitions");
    expect(capturedUrl?.searchParams.get("organizationId")).toBe("org_1");
    expect(capturedUrl?.searchParams.get("since")).toBe("0");
    expect(capturedUrl?.searchParams.get("limit")).toBe("50");
    expect(capturedAuth).toBe("Bearer tok123");
    expect(page.events).toHaveLength(1);
    expect(page.nextCursor).toBe("1");
    expect(page.hasMore).toBe(false);
  });

  it("throws LoopStatusError carrying the status on a non-2xx response", async () => {
    const fetchMock = (async () =>
      new Response("forbidden", { status: 403 })) as unknown as typeof fetch;
    const client = createLoopStatusClient({
      baseUrl: "https://cloud.example",
      getToken: () => "t",
      fetch: fetchMock,
    });
    await expect(client.pullTransitions({ organizationId: "org_1" })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("streamLoopState", () => {
  it("dispatches ping, loop-state-update, and resync-required frames", async () => {
    const body = [
      "event: ping\ndata: {\"type\":\"ping\"}\n\n",
      `event: loop-state-update\ndata: ${JSON.stringify(transition("1"))}\n\n`,
      "event: resync-required\ndata: {\"nextCursor\":\"1\"}\n\n",
    ];
    const fetchMock = (async () => sseResponse(body)) as unknown as typeof fetch;

    const events: LoopEvent[] = [];
    let pings = 0;
    let resyncCursor: string | null | undefined;
    const client = createLoopStatusClient({
      baseUrl: "https://cloud.example",
      getToken: () => "t",
      fetch: fetchMock,
    });

    await client.streamLoopState({
      organizationId: "org_1",
      onEvent: (e) => events.push(e),
      onPing: () => (pings += 1),
      onResyncRequired: (c) => (resyncCursor = c),
    });

    expect(pings).toBe(1);
    expect(events).toHaveLength(1);
    expect(cursorOf(events[0]!)).toBe("1");
    expect(resyncCursor).toBe("1");
  });

  it("handles frames split across chunk boundaries", async () => {
    const full = `event: loop-state-update\ndata: ${JSON.stringify(transition("9"))}\n\n`;
    const mid = Math.floor(full.length / 2);
    const fetchMock = (async () =>
      sseResponse([full.slice(0, mid), full.slice(mid)])) as unknown as typeof fetch;

    const events: LoopEvent[] = [];
    const client = createLoopStatusClient({
      baseUrl: "https://cloud.example",
      getToken: () => "t",
      fetch: fetchMock,
    });
    await client.streamLoopState({ organizationId: "org_1", onEvent: (e) => events.push(e) });

    expect(events).toHaveLength(1);
    expect(cursorOf(events[0]!)).toBe("9");
  });
});

// Copyright (c) Better Data, Inc. and contributors
// SPDX-License-Identifier: Apache-2.0

import type { LoopEvent } from "@loop-engine/events";
import { iterateSseFrames } from "./sse.js";

export interface LoopStatusClientOptions {
  /** Base URL of the Boss Loops Cloud status API, e.g. `https://cloud.bossloops.com`. */
  baseUrl: string;
  /**
   * Supplies the PLAT-AUTH-01 bearer token for a request. This client never mints
   * tokens — issuance is platform-only — the host supplies them. Called per
   * request so callers can hand back a freshly-minted short-TTL token.
   */
  getToken: () => string | Promise<string>;
  /** fetch override (tests / custom agents). Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** API version path segment. Default `v1`. */
  apiVersion?: string;
}

export interface TransitionPage {
  events: LoopEvent[];
  /** Opaque monotonic cursor to resume from (pass back as `since`); null if none. */
  nextCursor: string | null;
  /** True when the page was limit-filled — call again from `nextCursor`. */
  hasMore: boolean;
}

export interface PullParams {
  organizationId: string;
  since?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface StreamParams {
  organizationId: string;
  since?: string | null;
  signal?: AbortSignal;
  onEvent: (event: LoopEvent) => void;
  onPing?: () => void;
  /** Catch-up exceeded one page; drain the remainder via `pullTransitions` from `nextCursor`. */
  onResyncRequired?: (nextCursor: string | null) => void;
  onError?: (error: unknown) => void;
}

export interface LoopStatusClient {
  /** Cursor pull / replay — the durable backbone. */
  pullTransitions(params: PullParams): Promise<TransitionPage>;
  /** Open the live SSE stream. Resolves when the stream ends or is aborted. */
  streamLoopState(params: StreamParams): Promise<void>;
}

export class LoopStatusError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LoopStatusError";
    if (status !== undefined) this.status = status;
  }
}

/** Extract the resume cursor from a LoopEvent (`evidence.transition_event_id`). */
export function cursorOf(event: LoopEvent): string | null {
  const evidence = (event as { evidence?: Record<string, unknown> }).evidence;
  const id = evidence?.["transition_event_id"];
  return typeof id === "string" ? id : null;
}

export function createLoopStatusClient(options: LoopStatusClientOptions): LoopStatusClient {
  const base = options.baseUrl.replace(/\/+$/, "");
  const apiVersion = options.apiVersion ?? "v1";
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new LoopStatusError("no fetch implementation available; pass options.fetch");
  }

  function buildUrl(path: string, params: Record<string, string | null | undefined>): URL {
    const url = new URL(`${base}/api/${apiVersion}/loop-state/${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") url.searchParams.set(key, value);
    }
    return url;
  }

  async function authHeader(): Promise<string> {
    return `Bearer ${await options.getToken()}`;
  }

  return {
    async pullTransitions(params) {
      const url = buildUrl("transitions", {
        organizationId: params.organizationId,
        since: params.since ?? undefined,
        limit: params.limit != null ? String(params.limit) : undefined,
      });
      const init: RequestInit = {
        method: "GET",
        headers: { authorization: await authHeader(), accept: "application/json" },
      };
      if (params.signal) init.signal = params.signal;
      const response = await fetchImpl(url, init);
      if (!response.ok) {
        throw new LoopStatusError(
          `loop-status pull failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }
      const json = (await response.json()) as Partial<TransitionPage>;
      return {
        events: json.events ?? [],
        nextCursor: json.nextCursor ?? null,
        hasMore: Boolean(json.hasMore),
      };
    },

    async streamLoopState(params) {
      const url = buildUrl("stream", {
        organizationId: params.organizationId,
        since: params.since ?? undefined,
      });
      let response: Response;
      try {
        const init: RequestInit = {
          method: "GET",
          headers: { authorization: await authHeader(), accept: "text/event-stream" },
        };
        if (params.signal) init.signal = params.signal;
        response = await fetchImpl(url, init);
      } catch (error) {
        if (params.signal?.aborted) return;
        params.onError?.(error);
        throw error;
      }
      if (!response.ok) {
        const error = new LoopStatusError(
          `loop-status stream failed: ${response.status} ${response.statusText}`,
          response.status
        );
        params.onError?.(error);
        throw error;
      }
      if (!response.body) {
        const error = new LoopStatusError("loop-status stream returned no body");
        params.onError?.(error);
        throw error;
      }

      try {
        for await (const frame of iterateSseFrames(response.body)) {
          switch (frame.event) {
            case "ping":
              params.onPing?.();
              break;
            case "resync-required": {
              let nextCursor: string | null = null;
              try {
                nextCursor = (JSON.parse(frame.data) as { nextCursor?: string | null }).nextCursor ?? null;
              } catch {
                nextCursor = null;
              }
              params.onResyncRequired?.(nextCursor);
              break;
            }
            case "loop-state-update":
              try {
                params.onEvent(JSON.parse(frame.data) as LoopEvent);
              } catch (error) {
                params.onError?.(error);
              }
              break;
            default:
              break;
          }
        }
      } catch (error) {
        if (params.signal?.aborted) return;
        params.onError?.(error);
        throw error;
      }
    },
  };
}

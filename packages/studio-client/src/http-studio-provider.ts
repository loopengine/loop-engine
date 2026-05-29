// SPDX-License-Identifier: Apache-2.0

import type {
  RunDetailReadResponse,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
  RunReplaySummaryReadResponse,
  RunTimelineReadResponse,
} from "@loop-engine/observability";
import { StudioClientError, mapHttpStatusToStudioError } from "./errors.js";
import { resolveStudioRunUrl, studioRunApiPaths } from "./paths.js";
import type { StudioRunProvider } from "./types.js";
import { assertContractPayload } from "./validate.js";

export type HttpStudioProviderOptions = {
  /** Hosted-loops origin, e.g. `https://loops.betterdata.co` or `http://localhost:3012` */
  baseUrl: string;
  /**
   * Optional headers per request (Authorization, tenant, API key).
   * No auth is assumed — callers supply headers explicitly (RT-07).
   */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

async function resolveHeaders(
  headers?: HttpStudioProviderOptions["headers"],
): Promise<Record<string, string>> {
  if (!headers) return {};
  return typeof headers === "function" ? await headers() : headers;
}

export class HttpStudioProvider implements StudioRunProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: HttpStudioProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async requestJson<T extends { contractVersion: string }>(
    path: string,
  ): Promise<T> {
    const url = resolveStudioRunUrl(this.options.baseUrl, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(await resolveHeaders(this.options.headers)),
        },
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      throw new StudioClientError("network", `Request failed: ${url}`, { cause });
    } finally {
      clearTimeout(timer);
    }

    let body: unknown;
    const text = await response.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch (cause) {
        throw new StudioClientError("parse", "Invalid JSON response", {
          status: response.status,
          cause,
        });
      }
    }

    if (!response.ok) {
      throw mapHttpStatusToStudioError(response.status, body);
    }

    return assertContractPayload(body as T);
  }

  getRun(runId: string): Promise<RunDetailReadResponse> {
    return this.requestJson(studioRunApiPaths.run(runId));
  }

  getRunHistory(runId: string): Promise<RunHistoryReadResponse> {
    return this.requestJson(studioRunApiPaths.history(runId));
  }

  getRunEvidence(runId: string): Promise<RunEvidenceReadResponse> {
    return this.requestJson(studioRunApiPaths.evidence(runId));
  }

  getRunTimeline(runId: string): Promise<RunTimelineReadResponse> {
    return this.requestJson(studioRunApiPaths.timeline(runId));
  }

  getReplaySummary(runId: string): Promise<RunReplaySummaryReadResponse> {
    return this.requestJson(studioRunApiPaths.replaySummary(runId));
  }
}

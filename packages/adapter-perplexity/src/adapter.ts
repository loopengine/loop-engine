// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AdapterInput, ToolAdapter } from "@loop-engine/core";
import { guardEvidence as redactForAudit } from "@loop-engine/core";
import { PerplexityAdapterError, RateLimitError } from "./errors";
import { buildCompletionBody, resolveModel } from "./sonar";
import type { Citation, PerplexityApiResponse, PerplexityConfig, SonarResult } from "./types";

const DEFAULT_BASE = "https://api.perplexity.ai";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 200 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function normalizeCitations(data: PerplexityApiResponse): Citation[] {
  const byUrl = new Map<string, Citation>();
  const searchResults = data.search_results ?? [];
  for (const r of searchResults) {
    const url = r.url;
    if (!url) {
      continue;
    }
    const snippet = r.date ? `published: ${r.date}` : "";
    byUrl.set(url, { url, title: r.title ?? "", snippet });
  }

  const rawCitations = data.citations ?? [];
  for (const c of rawCitations) {
    const url = typeof c === "string" ? c : (c.url ?? "");
    if (!url) {
      continue;
    }
    if (!byUrl.has(url)) {
      byUrl.set(url, { url, title: typeof c === "object" && c && "title" in c ? String(c.title ?? "") : "", snippet: "" });
    }
  }

  return [...byUrl.values()];
}

function requireApiKey(config: PerplexityConfig): string {
  const key = config.apiKey ?? process.env.PERPLEXITY_API_KEY;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new PerplexityAdapterError(
      "[@loop-engine/adapter-perplexity] Missing API key. Set PERPLEXITY_API_KEY before invoking the adapter.",
      401,
      false
    );
  }
  return key.trim();
}

function baseUrl(config: PerplexityConfig): string {
  const fromEnv = process.env.PERPLEXITY_BASE_URL;
  const raw = config.baseUrl ?? (fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : DEFAULT_BASE);
  return raw.replace(/\/$/, "");
}

async function parseErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) {
      return res.statusText || `HTTP ${res.status}`;
    }
    try {
      const j = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return j.error?.message ?? j.message ?? text;
    } catch {
      return text;
    }
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

export class PerplexityAdapter implements ToolAdapter {
  readonly name = "perplexity-sonar";

  private readonly config: PerplexityConfig;

  constructor(config: PerplexityConfig = {}) {
    this.config = config;
  }

  guardEvidence(payload: unknown): unknown {
    return redactForAudit(payload, {
      stripFields: ["apiKey", "authorization", "x-api-key"],
      maskPatterns: [/pplx-[a-zA-Z0-9]+/g]
    });
  }

  async invoke(input: AdapterInput): Promise<SonarResult> {
    const apiKey = requireApiKey(this.config);
    const model = resolveModel(input, this.config);
    const body = buildCompletionBody(input, this.config, model);
    const url = `${baseUrl(this.config)}/chat/completions`;
    const timeoutMs = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = this.config.retries ?? DEFAULT_RETRIES;
    const maxAttempts = maxRetries + 1;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    };

    let lastStatus = 0;
    let lastMessage = "";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timer);
        const aborted = err instanceof Error && err.name === "AbortError";
        if (aborted && attempt < maxAttempts - 1) {
          lastMessage = `Request timed out after ${timeoutMs}ms`;
          await sleep(backoffMs(attempt));
          continue;
        }
        const msg = err instanceof Error ? err.message : "Unknown network error";
        throw new PerplexityAdapterError(
          `[@loop-engine/adapter-perplexity] ${aborted ? "Request timeout" : msg}`,
          aborted ? 408 : 0,
          aborted
        );
      }
      clearTimeout(timer);

      lastStatus = res.status;

      if (shouldRetryStatus(res.status) && attempt < maxAttempts - 1) {
        lastMessage = await parseErrorBody(res);
        await sleep(backoffMs(attempt));
        continue;
      }

      if (!res.ok) {
        const detail = await parseErrorBody(res);
        const retryable = shouldRetryStatus(res.status);
        if (res.status === 401) {
          throw new PerplexityAdapterError(
            `[@loop-engine/adapter-perplexity] Unauthorized: ${detail}`,
            401,
            false
          );
        }
        if (res.status === 400) {
          throw new PerplexityAdapterError(
            `[@loop-engine/adapter-perplexity] Bad request: ${detail}`,
            400,
            false
          );
        }
        if (res.status === 429) {
          throw new RateLimitError(`[@loop-engine/adapter-perplexity] Rate limited: ${detail}`);
        }
        throw new PerplexityAdapterError(
          `[@loop-engine/adapter-perplexity] ${detail}`,
          res.status,
          retryable
        );
      }

      let data: PerplexityApiResponse;
      try {
        data = (await res.json()) as PerplexityApiResponse;
      } catch {
        throw new PerplexityAdapterError(
          "[@loop-engine/adapter-perplexity] Invalid JSON in success response",
          502,
          true
        );
      }

      const text = data.choices?.[0]?.message?.content ?? "";
      if (typeof text !== "string") {
        throw new PerplexityAdapterError(
          "[@loop-engine/adapter-perplexity] Missing assistant message content",
          502,
          false
        );
      }

      const citations = normalizeCitations(data);
      const usage = data.usage ?? {};

      return {
        text,
        citations,
        model: data.model ?? model,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0
        },
        raw: data
      };
    }

    if (lastStatus === 429) {
      throw new RateLimitError(
        `[@loop-engine/adapter-perplexity] Rate limited after ${maxAttempts} attempts: ${lastMessage}`
      );
    }
    throw new PerplexityAdapterError(
      `[@loop-engine/adapter-perplexity] Exhausted retries (${lastStatus}): ${lastMessage}`,
      lastStatus || 503,
      true
    );
  }
}

export function createPerplexityAdapter(config?: PerplexityConfig): PerplexityAdapter {
  return new PerplexityAdapter(config ?? {});
}

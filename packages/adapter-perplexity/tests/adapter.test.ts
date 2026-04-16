// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createPerplexityAdapter } from "../src/index";

const successPayload = {
  id: "pplx-test",
  model: "sonar-pro",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Fusion milestones include sustained ignition trials." },
      finish_reason: "stop"
    }
  ],
  usage: { prompt_tokens: 10, completion_tokens: 40, total_tokens: 50 },
  citations: ["https://example.com/fusion"],
  search_results: [
    { title: "Fusion news", url: "https://example.com/fusion", date: "2026-01-15" }
  ]
};

describe("@loop-engine/adapter-perplexity", () => {
  let rate429Count = 0;
  let lastRequestBody: Record<string, unknown> | null = null;

  const server = setupServer();

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    rate429Count = 0;
    lastRequestBody = null;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "test-from-env";
    delete process.env.PERPLEXITY_BASE_URL;
    delete process.env.PERPLEXITY_DEFAULT_MODEL;
  });

  it("invoke() returns SonarResult with non-empty citations", async () => {
    server.use(
      http.post("https://api.perplexity.ai/chat/completions", async ({ request }) => {
        lastRequestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successPayload);
      })
    );

    const adapter = createPerplexityAdapter();
    const out = await adapter.invoke({ prompt: "Latest fusion breakthroughs?" });

    expect(out.text.length).toBeGreaterThan(0);
    expect(out.citations.length).toBeGreaterThan(0);
    expect(out.citations[0]?.url).toContain("example.com");
    expect(out.model).toBe("sonar-pro");
    expect(out.usage.promptTokens).toBe(10);
    expect(out.usage.completionTokens).toBe(40);
  });

  it("passes search_recency_filter day to the API", async () => {
    server.use(
      http.post("https://api.perplexity.ai/chat/completions", async ({ request }) => {
        lastRequestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successPayload);
      })
    );

    const adapter = createPerplexityAdapter();
    await adapter.invoke({
      prompt: "News today",
      metadata: { searchRecencyFilter: "day" }
    });

    expect(lastRequestBody?.search_recency_filter).toBe("day");
  });

  it("retries on 429 with backoff and succeeds on second attempt", async () => {
    server.use(
      http.post("https://api.perplexity.ai/chat/completions", () => {
        rate429Count += 1;
        if (rate429Count === 1) {
          return new HttpResponse(null, { status: 429 });
        }
        return HttpResponse.json(successPayload);
      })
    );

    const adapter = createPerplexityAdapter({ retries: 3 });
    const out = await adapter.invoke({ prompt: "Retry case" });
    expect(out.citations.length).toBeGreaterThan(0);
    expect(rate429Count).toBe(2);
  });

  it("401 throws PerplexityAdapterError with retryable false", async () => {
    server.use(
      http.post("https://api.perplexity.ai/chat/completions", () =>
        HttpResponse.json({ error: { message: "invalid key" } }, { status: 401 })
      )
    );

    const adapter = createPerplexityAdapter();
    await expect(adapter.invoke({ prompt: "x" })).rejects.toMatchObject({
      name: "PerplexityAdapterError",
      statusCode: 401,
      retryable: false
    });
  });

  it("guardEvidence strips apiKey and masks pplx- tokens in strings", () => {
    const adapter = createPerplexityAdapter();
    const out = adapter.guardEvidence({
      apiKey: "secret",
      note: "key pplx-abc123 in text",
      nested: { authorization: "Bearer x" }
    }) as Record<string, unknown>;

    expect(out.apiKey).toBeUndefined();
    expect(out.nested).toEqual({});
    expect(String(out.note)).toContain("[REDACTED]");
    expect(String(out.note)).not.toContain("pplx-abc123");
  });
});

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";

const createCompletionMock = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: createCompletionMock
      }
    };
  }
  return { default: MockOpenAI };
});

import { createOpenAIActorAdapter } from "../index";

describe("@loop-engine/adapter-openai", () => {
  beforeEach(() => {
    createCompletionMock.mockReset();
  });

  it("creates an AI submission from valid OpenAI JSON output", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reasoning: "Inventory spike expected next week",
              confidence: 0.87,
              dataPoints: { sku: "SKU-1" }
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission({
      signal: "scm.procurement.recommendation" as never,
      actorId: "agent-openai" as never,
      prompt: "Recommend a procurement action"
    });

    expect(submission.actor.type).toBe("ai-agent");
    expect(submission.actor.provider).toBe("openai");
    expect(submission.evidence.reasoning).toContain("Inventory spike");
    expect(submission.evidence.confidence).toBe(0.87);
  });

  it("computes promptHash asynchronously via crypto.subtle", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reasoning: "Hold order",
              confidence: 0.61
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission({
      signal: "scm.procurement.recommendation" as never,
      actorId: "agent-openai" as never,
      prompt: "Hash this prompt"
    });

    expect(submission.actor.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("throws when OpenAI returns no assistant content", async () => {
    createCompletionMock.mockResolvedValue({ choices: [{ message: { content: null } }] });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-openai" as never,
        prompt: "Test missing content"
      })
    ).rejects.toThrow(/returned no assistant message content/);
  });

  it("throws when OpenAI content is not valid JSON", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: "not-json" } }]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-openai" as never,
        prompt: "Test invalid json"
      })
    ).rejects.toThrow(/Invalid JSON response/);
  });

  it("throws when parsed confidence is outside 0..1", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reasoning: "test",
              confidence: 2
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-openai" as never,
        prompt: "Test confidence"
      })
    ).rejects.toThrow(/confidence must be between 0 and 1/);
  });

  it("wraps OpenAI SDK errors with adapter context", async () => {
    createCompletionMock.mockRejectedValue(new Error("rate limit exceeded"));

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-openai" as never,
        prompt: "Test API error"
      })
    ).rejects.toThrow(/\[loop-engine\/adapter-openai\] OpenAI API error: rate limit exceeded/);
  });
});

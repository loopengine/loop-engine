// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoopActorPromptContext } from "@loop-engine/core";

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

function makeContext(): LoopActorPromptContext {
  return {
    loopId: "scm.procurement",
    loopName: "SCM Procurement",
    currentState: "analyzing",
    availableSignals: [
      {
        signalId: "scm.procurement.recommendation",
        name: "Submit Recommendation",
        allowedActors: ["ai-agent"]
      }
    ],
    instruction: "Recommend a procurement action given inventory forecast.",
    evidence: { sku: "SKU-1", demandForecast: 0.9 }
  };
}

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
              signalId: "scm.procurement.recommendation",
              reasoning: "Inventory spike expected next week",
              confidence: 0.87,
              dataPoints: { sku: "SKU-1" }
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.actor.type).toBe("ai-agent");
    expect(submission.actor.provider).toBe("openai");
    expect(submission.signal as string).toBe("scm.procurement.recommendation");
    expect(submission.evidence.reasoning).toContain("Inventory spike");
    expect(submission.evidence.confidence).toBe(0.87);
    expect(submission.evidence.dataPoints).toEqual({ sku: "SKU-1" });
  });

  it("computes promptHash asynchronously via crypto.subtle", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "scm.procurement.recommendation",
              reasoning: "Hold order",
              confidence: 0.61
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.actor.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("throws when OpenAI returns no assistant content", async () => {
    createCompletionMock.mockResolvedValue({ choices: [{ message: { content: null } }] });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /returned no assistant message content/
    );
  });

  it("throws when OpenAI content is not valid JSON", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: "not-json" } }]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(/Invalid JSON response/);
  });

  it("throws when parsed signalId is outside availableSignals", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "not.a.real.signal",
              reasoning: "wrong signal",
              confidence: 0.8
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /signalId outside availableSignals/
    );
  });

  it("throws when parsed confidence is outside 0..1", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "scm.procurement.recommendation",
              reasoning: "test",
              confidence: 2
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /confidence must be between 0 and 1/
    );
  });

  it("wraps OpenAI SDK errors with adapter context", async () => {
    createCompletionMock.mockRejectedValue(new Error("rate limit exceeded"));

    const adapter = createOpenAIActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /\[loop-engine\/adapter-openai\] OpenAI API error: rate limit exceeded/
    );
  });

  it("uses construction-time maxTokens and temperature when provided", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "scm.procurement.recommendation",
              reasoning: "ok",
              confidence: 0.7
            })
          }
        }
      ]
    });

    const adapter = createOpenAIActorAdapter({
      apiKey: "test-key",
      maxTokens: 1200,
      temperature: 0.4
    });
    await adapter.createSubmission(makeContext());

    expect(createCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 1200,
        temperature: 0.4
      })
    );
  });
});

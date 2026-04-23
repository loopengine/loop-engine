// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoopActorPromptContext } from "@loop-engine/core";

const createMessageMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: createMessageMock
    };
  }
  return { default: MockAnthropic };
});

import { createAnthropicActorAdapter } from "../index";

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
    instruction: "Recommend procurement action given supplier lead time and stock levels.",
    evidence: { supplier: "s-1", leadTimeDays: 14 }
  };
}

describe("@loop-engine/adapter-anthropic", () => {
  beforeEach(() => {
    createMessageMock.mockReset();
  });

  it("creates an AI submission from valid Anthropic JSON output", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            signalId: "scm.procurement.recommendation",
            reasoning: "Supplier lead time increased",
            confidence: 0.82,
            dataPoints: { supplier: "s-1" }
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.actor.type).toBe("ai-agent");
    expect(submission.actor.provider).toBe("anthropic");
    expect(submission.signal as string).toBe("scm.procurement.recommendation");
    expect(submission.evidence.reasoning).toContain("lead time");
    expect(submission.evidence.confidence).toBe(0.82);
    expect(submission.evidence.dataPoints).toEqual({ supplier: "s-1" });
  });

  it("computes promptHash asynchronously via crypto.subtle", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            signalId: "scm.procurement.recommendation",
            reasoning: "Monitor for one day",
            confidence: 0.55
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.actor.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("throws when Anthropic returns no text block", async () => {
    createMessageMock.mockResolvedValue({
      content: [{ type: "tool_use" }]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(/returned no text block/);
  });

  it("throws when Anthropic text is not valid JSON", async () => {
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: "not-json" }]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(/Invalid JSON response/);
  });

  it("throws when parsed signalId is outside availableSignals", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            signalId: "not.a.real.signal",
            reasoning: "wrong signal",
            confidence: 0.8
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /signalId outside availableSignals/
    );
  });

  it("throws when parsed confidence is outside 0..1", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            signalId: "scm.procurement.recommendation",
            reasoning: "test",
            confidence: -0.2
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /confidence must be between 0 and 1/
    );
  });

  it("wraps Anthropic SDK errors with adapter context", async () => {
    createMessageMock.mockRejectedValue(new Error("upstream unavailable"));

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /\[loop-engine\/adapter-anthropic\] Anthropic API error: upstream unavailable/
    );
  });

  it("uses construction-time maxTokens and temperature when provided", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            signalId: "scm.procurement.recommendation",
            reasoning: "reasoned",
            confidence: 0.7
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({
      apiKey: "test-key",
      maxTokens: 1000,
      temperature: 0.3
    });
    await adapter.createSubmission(makeContext());

    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 1000,
        temperature: 0.3
      })
    );
  });
});

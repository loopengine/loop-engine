// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";

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
            reasoning: "Supplier lead time increased",
            confidence: 0.82,
            dataPoints: { supplier: "s-1" }
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission({
      signal: "scm.procurement.recommendation" as never,
      actorId: "agent-claude" as never,
      prompt: "Recommend procurement action"
    });

    expect(submission.actor.type).toBe("ai-agent");
    expect(submission.actor.provider).toBe("anthropic");
    expect(submission.evidence.reasoning).toContain("lead time");
    expect(submission.evidence.confidence).toBe(0.82);
  });

  it("computes promptHash asynchronously via crypto.subtle", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reasoning: "Monitor for one day",
            confidence: 0.55
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    const submission = await adapter.createSubmission({
      signal: "scm.procurement.recommendation" as never,
      actorId: "agent-claude" as never,
      prompt: "Hash this anthropic prompt"
    });

    expect(submission.actor.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("throws when Anthropic returns no text block", async () => {
    createMessageMock.mockResolvedValue({
      content: [{ type: "tool_use" }]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-claude" as never,
        prompt: "Test missing text"
      })
    ).rejects.toThrow(/returned no text block/);
  });

  it("throws when Anthropic text is not valid JSON", async () => {
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: "not-json" }]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-claude" as never,
        prompt: "Test invalid json"
      })
    ).rejects.toThrow(/Invalid JSON response/);
  });

  it("throws when parsed confidence is outside 0..1", async () => {
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reasoning: "test",
            confidence: -0.2
          })
        }
      ]
    });

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-claude" as never,
        prompt: "Test confidence"
      })
    ).rejects.toThrow(/confidence must be between 0 and 1/);
  });

  it("wraps Anthropic SDK errors with adapter context", async () => {
    createMessageMock.mockRejectedValue(new Error("upstream unavailable"));

    const adapter = createAnthropicActorAdapter({ apiKey: "test-key" });
    await expect(
      adapter.createSubmission({
        signal: "scm.procurement.recommendation" as never,
        actorId: "agent-claude" as never,
        prompt: "Test API error"
      })
    ).rejects.toThrow(/\[loop-engine\/adapter-anthropic\] Anthropic API error: upstream unavailable/);
  });
});

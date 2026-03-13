// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoopActorPromptContext } from "@loop-engine/actors";

const createCompletionMock = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createCompletionMock
      }
    }
  }))
}));

import { ActorDecisionError, createGrokActorAdapter } from "../index";

function makeContext(): LoopActorPromptContext {
  return {
    loopId: "procurement",
    loopName: "SCM Procurement",
    currentState: "pending_analysis",
    availableSignals: [
      {
        signalId: "submit_recommendation",
        name: "Submit Recommendation",
        allowedActors: ["ai-agent"]
      }
    ],
    instruction: "Analyze demand data and recommend a purchase order decision.",
    evidence: { demandForecast: 0.91, currentStock: 38 }
  };
}

describe("@loop-engine/adapter-grok", () => {
  beforeEach(() => {
    createCompletionMock.mockReset();
  });

  it("createSubmission returns valid AIAgentActor with type ai-agent", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "submit_recommendation",
              reasoning: "Demand exceeds stock",
              confidence: 0.85
            })
          }
        }
      ]
    });

    const adapter = createGrokActorAdapter("xai-key");
    const result = await adapter.createSubmission(makeContext());

    expect(result.actor.type).toBe("ai-agent");
    expect(result.actor.provider).toBe("grok");
  });

  it("createSubmission returns decision with valid signalId", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "submit_recommendation",
              reasoning: "Stock is below threshold",
              confidence: 0.9
            })
          }
        }
      ]
    });

    const context = makeContext();
    const adapter = createGrokActorAdapter("xai-key");
    const result = await adapter.createSubmission(context);

    expect(context.availableSignals.map((s) => s.signalId)).toContain(result.decision.signalId);
  });

  it("actor.promptHash is a non-empty string", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "submit_recommendation",
              reasoning: "Apply conservative reorder",
              confidence: 0.81
            })
          }
        }
      ]
    });

    const adapter = createGrokActorAdapter("xai-key");
    const result = await adapter.createSubmission(makeContext());

    expect(typeof result.actor.promptHash).toBe("string");
    expect((result.actor.promptHash ?? "").length).toBeGreaterThan(0);
  });

  it("throws ActorDecisionError with code INVALID_SIGNAL", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "unknown_signal",
              reasoning: "Invalid signal choice",
              confidence: 0.8
            })
          }
        }
      ]
    });

    const adapter = createGrokActorAdapter("xai-key");

    await expect(adapter.createSubmission(makeContext())).rejects.toMatchObject({
      code: "INVALID_SIGNAL"
    } satisfies Partial<ActorDecisionError>);
  });

  it("throws ActorDecisionError with code INVALID_CONFIDENCE", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              signalId: "submit_recommendation",
              reasoning: "Confidence too high",
              confidence: 1.5
            })
          }
        }
      ]
    });

    const adapter = createGrokActorAdapter("xai-key");

    await expect(adapter.createSubmission(makeContext())).rejects.toMatchObject({
      code: "INVALID_CONFIDENCE"
    } satisfies Partial<ActorDecisionError>);
  });

  it("throws ActorDecisionError with code API_ERROR", async () => {
    createCompletionMock.mockRejectedValue(new Error("xAI API rate limit exceeded"));

    const adapter = createGrokActorAdapter("xai-key");

    await expect(adapter.createSubmission(makeContext())).rejects.toMatchObject({
      code: "API_ERROR"
    } satisfies Partial<ActorDecisionError>);

    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /\[loop-engine\/adapter-grok\]/
    );
  });
});

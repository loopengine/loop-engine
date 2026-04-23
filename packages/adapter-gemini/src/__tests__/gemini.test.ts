// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoopActorPromptContext } from "@loop-engine/core";

const generateContentMock = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: generateContentMock
    })
  }))
}));

import { ActorDecisionError, createGeminiActorAdapter } from "../index";

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
    evidence: { demandForecast: 0.87, currentStock: 45 }
  };
}

function validResponse() {
  return {
    response: {
      text: () =>
        JSON.stringify({
          signalId: "submit_recommendation",
          reasoning: "Demand forecast indicates reorder needed",
          confidence: 0.88,
          dataPoints: { forecastedDemand: 0.88 }
        })
    }
  };
}

describe("@loop-engine/adapter-gemini", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it("createSubmission returns an AIAgentSubmission with ai-agent actor", async () => {
    generateContentMock.mockResolvedValue(validResponse());

    const adapter = createGeminiActorAdapter("google-key");
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.actor.type).toBe("ai-agent");
    expect(submission.actor.provider).toBe("gemini");
  });

  it("createSubmission returns the model-selected signal (validated against context)", async () => {
    generateContentMock.mockResolvedValue(validResponse());

    const context = makeContext();
    const adapter = createGeminiActorAdapter("google-key");
    const submission = await adapter.createSubmission(context);

    expect(context.availableSignals.map((s) => s.signalId)).toContain(submission.signal as string);
  });

  it("actor.promptHash is a non-empty string", async () => {
    generateContentMock.mockResolvedValue(validResponse());

    const adapter = createGeminiActorAdapter("google-key");
    const submission = await adapter.createSubmission(makeContext());

    expect(typeof submission.actor.promptHash).toBe("string");
    expect((submission.actor.promptHash ?? "").length).toBeGreaterThan(0);
  });

  it("handles markdown code fence stripping correctly", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () =>
          "```json\n{\"signalId\":\"submit_recommendation\",\"reasoning\":\"test\",\"confidence\":0.9}\n```"
      }
    });

    const adapter = createGeminiActorAdapter("google-key");
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.signal as string).toBe("submit_recommendation");
  });

  it("throws ActorDecisionError with code INVALID_SIGNAL", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            signalId: "not_a_real_signal",
            reasoning: "invalid",
            confidence: 0.8
          })
      }
    });

    const adapter = createGeminiActorAdapter("google-key");

    await expect(adapter.createSubmission(makeContext())).rejects.toMatchObject({
      code: "INVALID_SIGNAL"
    } satisfies Partial<ActorDecisionError>);
  });

  it("throws ActorDecisionError with code API_ERROR", async () => {
    generateContentMock.mockRejectedValue(new Error("RESOURCE_EXHAUSTED"));

    const adapter = createGeminiActorAdapter("google-key");

    await expect(adapter.createSubmission(makeContext())).rejects.toMatchObject({
      code: "API_ERROR"
    } satisfies Partial<ActorDecisionError>);

    await expect(adapter.createSubmission(makeContext())).rejects.toThrow(
      /\[loop-engine\/adapter-gemini\]/
    );
  });

  it("evidence carries reasoning, confidence, dataPoints, and modelResponse", async () => {
    generateContentMock.mockResolvedValue(validResponse());

    const adapter = createGeminiActorAdapter("google-key");
    const submission = await adapter.createSubmission(makeContext());

    expect(submission.evidence.reasoning).toBe("Demand forecast indicates reorder needed");
    expect(submission.evidence.confidence).toBe(0.88);
    expect(submission.evidence.dataPoints).toEqual({ forecastedDemand: 0.88 });
    expect(submission.evidence.modelResponse).toBeDefined();
  });
});

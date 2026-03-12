// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { ActorRefSchema, TransitionSpecSchema } from "@loop-engine/core";
import { AIAgentActorSchema, buildAIActorEvidence, isAuthorized } from "..";

const transition = TransitionSpecSchema.parse({
  transitionId: "resolve",
  from: "OPEN",
  to: "RESOLVED",
  signal: "support.ticket.resolve",
  allowedActors: ["human", "automation"]
});

describe("actors package", () => {
  it("isAuthorized returns true when actor.type in allowedActors", () => {
    const actor = ActorRefSchema.parse({ id: "user-1", type: "human" });
    const result = isAuthorized(actor, transition);
    expect(result.authorized).toBe(true);
  });

  it("isAuthorized returns false when actor.type not in allowedActors", () => {
    const actor = ActorRefSchema.parse({ id: "agent-1", type: "ai-agent" });
    const result = isAuthorized(actor, transition);
    expect(result.authorized).toBe(false);
  });

  it("isAuthorized returns false with descriptive reason string", () => {
    const actor = ActorRefSchema.parse({ id: "agent-1", type: "ai-agent" });
    const result = isAuthorized(actor, transition);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("Actor type not allowed for this transition");
  });

  it("buildAIActorEvidence throws if confidence > 1", async () => {
    await expect(
      buildAIActorEvidence({
        modelId: "gpt-4o",
        provider: "openai",
        reasoning: "test",
        confidence: 1.1
      })
    ).rejects.toThrow(/confidence must be between 0 and 1/);
  });

  it("buildAIActorEvidence throws if confidence < 0", async () => {
    await expect(
      buildAIActorEvidence({
        modelId: "claude-opus",
        provider: "anthropic",
        reasoning: "test",
        confidence: -0.1
      })
    ).rejects.toThrow(/confidence must be between 0 and 1/);
  });

  it("AIAgentActor schema validates modelId and provider as required strings", () => {
    const valid = AIAgentActorSchema.safeParse({
      id: "agent-1",
      type: "ai-agent",
      modelId: "gpt-4o",
      provider: "openai"
    });
    expect(valid.success).toBe(true);

    const invalid = AIAgentActorSchema.safeParse({
      id: "agent-1",
      type: "ai-agent"
    });
    expect(invalid.success).toBe(false);
  });
});

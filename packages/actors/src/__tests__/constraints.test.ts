// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { actorId, transitionId, type TransitionSpec } from "@loopengine/core";
import { buildActorEvidence } from "../evidence";
import { canActorExecuteTransition } from "../constraints";

const humanTransition: TransitionSpec = {
  id: transitionId("approve"),
  from: "OPEN" as never,
  to: "CLOSED" as never,
  allowedActors: ["human"]
};

const aiTransition: TransitionSpec = {
  id: transitionId("recommend"),
  from: "OPEN" as never,
  to: "IN_REVIEW" as never,
  allowedActors: ["human", "ai-agent"]
};

describe("actors constraints", () => {
  it("Human authorized for human transition", () => {
    const result = canActorExecuteTransition(
      { type: "human", id: actorId("user@example.com"), sessionId: "s1" },
      humanTransition
    );
    expect(result.authorized).toBe(true);
  });

  it("AI authorized for ai-allowed transition", () => {
    const result = canActorExecuteTransition(
      { type: "ai-agent", id: actorId("agent:icp"), agentId: "icp", gatewaySessionId: "g1" },
      aiTransition
    );
    expect(result.authorized).toBe(true);
  });

  it("AI rejected for human-only transition (requiresApproval: true)", () => {
    const result = canActorExecuteTransition(
      { type: "ai-agent", id: actorId("agent:icp"), agentId: "icp", gatewaySessionId: "g1" },
      humanTransition
    );
    expect(result.authorized).toBe(false);
    expect(result.requiresApproval).toBe(true);
  });

  it("Circuit breaker fires after maxConsecutiveAITransitions", () => {
    const result = canActorExecuteTransition(
      { type: "ai-agent", id: actorId("agent:icp"), agentId: "icp", gatewaySessionId: "g1" },
      aiTransition,
      {
        canRecommendTransitions: true,
        canExecuteTransitions: true,
        requiresHumanApprovalFor: [],
        maxConsecutiveAITransitions: 2,
        currentConsecutiveAITransitions: 2
      }
    );
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("ai_circuit_breaker");
  });

  it("buildActorEvidence includes actor_type for all actor types", () => {
    const ev = buildActorEvidence(
      { type: "automation", id: actorId("system:sync"), serviceId: "sync" },
      { source: "test" }
    );
    expect(ev.actor_type).toBe("automation");
  });

  it("buildActorEvidence includes ai_reasoning only for AIAgentActor", () => {
    const ai = buildActorEvidence(
      { type: "ai-agent", id: actorId("agent:icp"), agentId: "icp", gatewaySessionId: "g1" },
      { ai_reasoning: "looks good", ai_confidence: 0.9 }
    );
    const human = buildActorEvidence(
      { type: "human", id: actorId("user@example.com"), sessionId: "s1" },
      { ai_reasoning: "ignored" }
    );
    expect(ai.ai_reasoning).toBe("looks good");
    expect(human.ai_agent_id).toBeUndefined();
  });
});

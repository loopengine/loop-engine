// @license MIT
// SPDX-License-Identifier: MIT
import type { TransitionId, TransitionSpec } from "@loopengine/core";
import type { Actor } from "./types";

export interface AIActorConstraints {
  canRecommendTransitions: true;
  canExecuteTransitions: boolean;
  requiresHumanApprovalFor: TransitionId[];
  maxConsecutiveAITransitions: number;
  currentConsecutiveAITransitions?: number;
}

export function canActorExecuteTransition(
  actor: Actor,
  transition: TransitionSpec,
  constraints?: AIActorConstraints
): { authorized: boolean; requiresApproval: boolean; reason?: string } {
  const typeAllowed = transition.allowedActors.includes(actor.type);
  if (!typeAllowed) {
    if (actor.type === "ai-agent") {
      return { authorized: false, requiresApproval: true, reason: "human_approval_required" };
    }
    return { authorized: false, requiresApproval: false, reason: "unauthorized_actor" };
  }

  if (actor.type !== "ai-agent") {
    return { authorized: true, requiresApproval: false };
  }

  if (!constraints) {
    return { authorized: true, requiresApproval: false };
  }
  if (!constraints.canExecuteTransitions) {
    return { authorized: false, requiresApproval: true, reason: "human_approval_required" };
  }
  if (constraints.requiresHumanApprovalFor.includes(transition.id)) {
    return { authorized: false, requiresApproval: true, reason: "human_approval_required" };
  }
  if (
    typeof constraints.currentConsecutiveAITransitions === "number" &&
    constraints.currentConsecutiveAITransitions >= constraints.maxConsecutiveAITransitions
  ) {
    return { authorized: false, requiresApproval: true, reason: "ai_circuit_breaker" };
  }
  return { authorized: true, requiresApproval: false };
}

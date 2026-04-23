// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { ActorRef, TransitionId, TransitionSpec } from "@loop-engine/core";

export interface AIActorConstraints {
  requiresHumanApprovalFor?: TransitionId[];
}

export interface ActorAuthorizationResult {
  authorized: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export function canActorExecuteTransition(
  actor: ActorRef,
  transition: TransitionSpec,
  constraints?: AIActorConstraints
): ActorAuthorizationResult {
  if (!transition.allowedActors.includes(actor.type)) {
    return {
      authorized: false,
      requiresApproval: false,
      reason: "Actor type not allowed for this transition"
    };
  }

  if (
    actor.type === "ai-agent" &&
    constraints?.requiresHumanApprovalFor?.includes(transition.transitionId)
  ) {
    return { authorized: true, requiresApproval: true };
  }

  return { authorized: true, requiresApproval: false };
}

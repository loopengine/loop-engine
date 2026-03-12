// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { ActorRef, TransitionSpec } from "@loop-engine/core";

export interface ActorAuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export function isAuthorized(
  actor: ActorRef,
  transition: TransitionSpec
): ActorAuthorizationResult {
  if (!transition.allowedActors.includes(actor.type)) {
    return {
      authorized: false,
      reason: "Actor type not allowed for this transition"
    };
  }
  return { authorized: true };
}

// @license MIT
// SPDX-License-Identifier: MIT
import type { Evidence } from "@loop-engine/core";
import type { Actor } from "./types";

export function buildActorEvidence(actor: Actor, baseEvidence: Evidence): Evidence {
  const merged: Evidence = {
    ...baseEvidence,
    actor_type: actor.type,
    actor_id: actor.id
  };
  if (actor.type === "ai-agent") {
    merged.ai_agent_id = actor.agentId;
    if ("ai_confidence" in baseEvidence) {
      merged.ai_confidence = baseEvidence.ai_confidence;
    }
    if ("ai_reasoning" in baseEvidence) {
      merged.ai_reasoning = baseEvidence.ai_reasoning;
    }
  }
  return merged;
}

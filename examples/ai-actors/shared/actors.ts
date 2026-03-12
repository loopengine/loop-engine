import { buildActorEvidence } from "@loop-engine/actors";
import type { AIAgentActor } from "@loop-engine/actors";
import type { AIRecommendation } from "./types";

/**
 * Build an AIAgentActor for the forecasting agent.
 * agentId is provider-specific — caller provides it.
 * gatewaySessionId represents the AI inference session.
 */
export function buildForecastingActor(
  agentId: string,
  gatewaySessionId: string
): AIAgentActor {
  return {
    type: "ai-agent",
    id: "agent:demand-forecaster",
    agentId,
    gatewaySessionId
  };
}

/**
 * Build evidence from an AI recommendation.
 * Includes Loop Engine's standard AI evidence fields
 * plus the recommendation-specific fields.
 */
export function buildRecommendationEvidence(
  actor: AIAgentActor,
  recommendation: AIRecommendation,
  signalId: string
) {
  return buildActorEvidence(actor, {
    ai_confidence: recommendation.confidence,
    ai_reasoning: recommendation.reasoning,
    recommended_action: recommendation.action,
    recommended_qty: recommendation.recommendedQty,
    estimated_cost: recommendation.estimatedCost,
    urgency: recommendation.urgency,
    source_signal_id: signalId
  });
}

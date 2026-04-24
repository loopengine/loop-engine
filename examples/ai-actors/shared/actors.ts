import { buildAIActorEvidence } from "@loop-engine/actors";
import { actorId, type AIAgentActor } from "@loop-engine/core";
import type { AIRecommendation } from "./types";

/**
 * Build an AIAgentActor for the forecasting agent.
 *
 * Per D-13 the `AIAgentActor` shape centers on `provider` + `modelId`
 * (the canonical AI provenance pair). Callers pass the provider handle
 * (e.g. `"anthropic"`, `"openai"`) and the model identifier (e.g.
 * `"claude-3-5-sonnet-20241022"`) specific to the inference call.
 */
export function buildForecastingActor(
  provider: string,
  modelId: string
): AIAgentActor {
  return {
    type: "ai-agent",
    id: actorId("agent:demand-forecaster"),
    provider,
    modelId
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
  return buildAIActorEvidence({
    provider: actor.provider,
    modelId: actor.modelId,
    reasoning: recommendation.reasoning,
    confidence: recommendation.confidence,
    dataPoints: {
      recommended_action: recommendation.action,
      recommended_qty: recommendation.recommendedQty,
      estimated_cost: recommendation.estimatedCost,
      urgency: recommendation.urgency,
      source_signal_id: signalId
    }
  });
}

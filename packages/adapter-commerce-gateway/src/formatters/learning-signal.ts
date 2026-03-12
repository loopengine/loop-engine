import type { LoopOutcomeEvent } from "../client/types";

export function toLoopOutcomeEvent(input: {
  loopId: string;
  aggregateId: string;
  outcomeId: string;
  metadata?: Record<string, unknown>;
}): LoopOutcomeEvent {
  return {
    loopId: input.loopId,
    aggregateId: input.aggregateId,
    outcomeId: input.outcomeId,
    occurredAt: new Date().toISOString(),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

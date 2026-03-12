// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { ActorType } from "@loop-engine/core";
import type {
  LearningSignal,
  LoopCompletedEvent,
  LoopDefinitionLike,
  LoopTransitionExecutedEvent
} from "./events";

export function extractLearningSignal(
  completed: LoopCompletedEvent,
  history: LoopTransitionExecutedEvent[],
  definition: LoopDefinitionLike,
  predicted?: Record<string, number>
): LearningSignal {
  const businessMetricIds = definition.outcome?.businessMetrics.map((metric) => metric.id) ?? [];

  let filteredPredicted: Record<string, number> | undefined;
  if (predicted) {
    filteredPredicted = {};
    for (const [key, value] of Object.entries(predicted)) {
      if (businessMetricIds.includes(key)) {
        filteredPredicted[key] = value;
      } else {
        console.warn(`[loop-events] Ignoring predicted metric not in definition: ${key}`);
      }
    }
  }

  let actual: Record<string, number> | undefined;
  if (businessMetricIds.length > 0) {
    actual = {};
    if (businessMetricIds.includes("cycle_time_days")) {
      actual.cycle_time_days = completed.durationMs / 86_400_000;
    }
  }

  let delta: Record<string, number> | undefined;
  if (filteredPredicted && actual) {
    const common = Object.keys(filteredPredicted).filter((key) => key in actual);
    if (common.length > 0) {
      delta = {};
      for (const key of common) {
        const pred = filteredPredicted[key];
        const act = actual[key];
        if (typeof pred === "number" && typeof act === "number") {
          delta[key] = act - pred;
        }
      }
    }
  }

  const counts = new Map<ActorType, number>();
  for (const transition of history) {
    const actorType = transition.actor.type;
    counts.set(actorType, (counts.get(actorType) ?? 0) + 1);
  }
  const actorSummary = Array.from(counts.entries()).map(([actorType, transitionCount]) => ({
    actorType,
    transitionCount
  }));

  return {
    loopId: completed.loopId,
    aggregateId: completed.aggregateId,
    loopName: definition.name,
    completedAt: completed.occurredAt,
    durationMs: completed.durationMs,
    transitionCount: history.length,
    businessMetricIds,
    ...(filteredPredicted ? { predicted: filteredPredicted } : {}),
    ...(actual && Object.keys(actual).length > 0 ? { actual } : {}),
    ...(delta && Object.keys(delta).length > 0 ? { delta } : {}),
    actorSummary
  };
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopId } from "@loop-engine/core";
import type { RuntimeLoopInstance, RuntimeTransitionRecord } from "@loop-engine/runtime";

export interface LoopMetrics {
  loopId: LoopId;
  period: { from: string; to: string };
  totalInstances: number;
  openInstances: number;
  closedInstances: number;
  errorInstances: number;
  avgDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  completionRate: number;
  guardFailureRate: number;
  aiActorRate: number;
  humanActorRate: number;
  avgTransitionCount: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

export function computeMetrics(
  instances: RuntimeLoopInstance[],
  history: RuntimeTransitionRecord[],
  period: { from: string; to: string }
): LoopMetrics {
  const first = instances[0];
  const loop = (first?.loopId ?? "unknown.loop") as LoopId;
  const total = instances.length;
  const open = instances.filter((instance) => instance.status === "active").length;
  const closed = instances.filter((instance) => instance.status === "completed").length;
  const error = instances.filter((instance) => instance.status === "failed").length;

  const durations = instances
    .map((instance) =>
      instance.completedAt ? Date.parse(instance.completedAt) - Date.parse(instance.startedAt) : 0
    )
    .filter((duration) => duration > 0);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const aiTransitions = history.filter((record) => record.actor.type === "ai-agent").length;
  const humanTransitions = history.filter((record) => record.actor.type === "human").length;
  const totalTransitions = history.length;

  const byAggregate = new Map<string, number>();
  for (const record of history) {
    byAggregate.set(record.aggregateId, (byAggregate.get(record.aggregateId) ?? 0) + 1);
  }

  return {
    loopId: loop,
    period,
    totalInstances: total,
    openInstances: open,
    closedInstances: closed,
    errorInstances: error,
    avgDurationMs: avg,
    medianDurationMs: percentile(durations, 50),
    p95DurationMs: percentile(durations, 95),
    completionRate: closed + error > 0 ? closed / (closed + error) : 0,
    guardFailureRate: 0,
    aiActorRate: totalTransitions > 0 ? aiTransitions / totalTransitions : 0,
    humanActorRate: totalTransitions > 0 ? humanTransitions / totalTransitions : 0,
    avgTransitionCount:
      byAggregate.size > 0
        ? [...byAggregate.values()].reduce((a, b) => a + b, 0) / byAggregate.size
        : 0
  };
}

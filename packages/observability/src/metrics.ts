// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopId, LoopInstance, TransitionRecord } from "@loop-engine/core";

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
  instances: LoopInstance[],
  history: TransitionRecord[],
  period: { from: string; to: string }
): LoopMetrics {
  const first = instances[0];
  const loop = (first?.loopId ?? "unknown.loop") as LoopId;
  const total = instances.length;
  const open = instances.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;
  const closed = instances.filter((i) => i.status === "CLOSED").length;
  const error = instances.filter((i) => i.status === "ERROR").length;

  const durations = instances
    .map((i) => (i.closedAt ? Date.parse(i.closedAt) - Date.parse(i.startedAt) : 0))
    .filter((d) => d > 0);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const aiTransitions = history.filter((r) => r.actor.type === "ai-agent").length;
  const humanTransitions = history.filter((r) => r.actor.type === "human").length;
  const totalTransitions = history.length;

  const byAggregate = new Map<string, number>();
  for (const r of history) {
    byAggregate.set(r.aggregateId, (byAggregate.get(r.aggregateId) ?? 0) + 1);
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

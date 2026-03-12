// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { AggregateId, StateId } from "@loop-engine/core";
import type { RuntimeLoopInstance, RuntimeTransitionRecord } from "@loop-engine/runtime";

export interface LoopTimeline {
  aggregateId: AggregateId;
  loopId: RuntimeLoopInstance["loopId"];
  instance: RuntimeLoopInstance;
  transitions: RuntimeTransitionRecord[];
  durationMs: number;
  isComplete: boolean;
}

export interface StateResidency {
  stateId: StateId;
  enteredAt: string;
  exitedAt?: string;
  durationMs?: number;
}

export function buildTimeline(
  instance: RuntimeLoopInstance,
  history: RuntimeTransitionRecord[]
): LoopTimeline {
  const end = instance.completedAt ?? new Date().toISOString();
  return {
    aggregateId: instance.aggregateId,
    loopId: instance.loopId,
    instance,
    transitions: [...history].sort(
      (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    ),
    durationMs: Math.max(0, Date.parse(end) - Date.parse(instance.startedAt)),
    isComplete: instance.status === "completed"
  };
}

export function getStateResidency(timeline: LoopTimeline): StateResidency[] {
  const out: StateResidency[] = [];
  let currentState = timeline.instance.currentState;
  let enteredAt = timeline.instance.startedAt;
  for (const t of timeline.transitions) {
    out.push({
      stateId: currentState,
      enteredAt,
      exitedAt: t.occurredAt,
      durationMs: Math.max(0, Date.parse(t.occurredAt) - Date.parse(enteredAt))
    });
    currentState = t.toState;
    enteredAt = t.occurredAt;
  }
  out.push({
    stateId: currentState,
    enteredAt,
    ...(timeline.instance.completedAt ? { exitedAt: timeline.instance.completedAt } : {}),
    ...(timeline.instance.completedAt
      ? { durationMs: Math.max(0, Date.parse(timeline.instance.completedAt) - Date.parse(enteredAt)) }
      : {})
  });
  return out;
}

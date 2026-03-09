// @license MIT
// SPDX-License-Identifier: MIT
import type { AggregateId, LoopInstance, StateId, TransitionRecord } from "@loop-engine/core";

export interface LoopTimeline {
  aggregateId: AggregateId;
  loopId: string;
  instance: LoopInstance;
  transitions: TransitionRecord[];
  durationMs: number;
  isComplete: boolean;
}

export interface StateResidency {
  stateId: StateId;
  enteredAt: string;
  exitedAt?: string;
  durationMs?: number;
}

export function buildTimeline(instance: LoopInstance, history: TransitionRecord[]): LoopTimeline {
  const end = instance.closedAt ?? new Date().toISOString();
  return {
    aggregateId: instance.aggregateId,
    loopId: instance.loopId,
    instance,
    transitions: [...history].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)),
    durationMs: Math.max(0, Date.parse(end) - Date.parse(instance.startedAt)),
    isComplete: instance.status === "CLOSED"
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
    ...(timeline.instance.closedAt ? { exitedAt: timeline.instance.closedAt } : {}),
    ...(timeline.instance.closedAt
      ? { durationMs: Math.max(0, Date.parse(timeline.instance.closedAt) - Date.parse(enteredAt)) }
      : {})
  });
  return out;
}

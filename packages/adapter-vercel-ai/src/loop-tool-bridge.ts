// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.
import type { ActorRef, AggregateId, LoopDefinition } from "@loop-engine/core";
import type { LoopSystem } from "@loop-engine/runtime";

type TargetState = "AI_ANALYSIS" | "PENDING_HUMAN_APPROVAL" | "EXECUTING" | "EXECUTED";

export async function startGovernedLoop(
  engine: LoopSystem,
  definition: LoopDefinition,
  actor: ActorRef
): Promise<AggregateId> {
  const instanceId = `loop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as AggregateId;
  await engine.startLoop({
    loopId: definition.loopId,
    aggregateId: instanceId,
    actor
  });
  return instanceId;
}

export async function transitionToState(
  engine: LoopSystem,
  definition: LoopDefinition,
  instanceId: AggregateId,
  toState: TargetState,
  actor: ActorRef,
  evidence?: Record<string, unknown>
): Promise<void> {
  const instance = await engine.getLoop(instanceId);
  if (!instance) {
    throw new Error(`[loop-engine/adapter-vercel-ai] instance not found for ${instanceId}`);
  }
  const current = String(instance.currentState);
  if (current === toState) return;

  const transition = definition.transitions.find(
    (item) => String(item.from) === current && String(item.to) === toState
  );
  if (!transition) {
    throw new Error(
      `[loop-engine/adapter-vercel-ai] missing transition ${current} -> ${toState} in ${definition.loopId}`
    );
  }

  const result = await engine.transition({
    aggregateId: instanceId,
    transitionId: transition.transitionId,
    actor,
    ...(evidence ? { evidence } : {})
  });
  if (result.status === "executed") return;
  if (result.status === "guard_failed") {
    throw new Error(
      `[loop-engine/adapter-vercel-ai] guard failed on ${String(transition.transitionId)}: ${
        result.guardFailures?.[0]?.guardId ?? "unknown_guard"
      }`
    );
  }
  throw new Error(
    `[loop-engine/adapter-vercel-ai] transition ${String(transition.transitionId)} returned status ${result.status}`
  );
}

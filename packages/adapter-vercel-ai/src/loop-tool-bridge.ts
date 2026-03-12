import { aggregateId, transitionId, type AggregateId, type ActorRef, type Evidence, type LoopDefinition } from "@loop-engine/core";
import type { LoopEngine } from "@loop-engine/runtime";

type TargetState = "AI_ANALYSIS" | "PENDING_HUMAN_APPROVAL" | "EXECUTING" | "EXECUTED";

export async function startGovernedLoop(engine: LoopEngine, definition: LoopDefinition, actor: ActorRef): Promise<AggregateId> {
  const instanceId = aggregateId(`loop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  await engine.start({
    loopId: String(definition.id),
    aggregateId: instanceId,
    orgId: "default",
    actor: { type: actor.type, id: String(actor.id) }
  });
  return instanceId;
}

export async function transitionToState(
  engine: LoopEngine,
  definition: LoopDefinition,
  instanceId: AggregateId,
  toState: TargetState,
  actor: ActorRef,
  evidence?: Evidence
): Promise<void> {
  const instance = await engine.getState(instanceId);
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
      `[loop-engine/adapter-vercel-ai] missing transition ${current} -> ${toState} in ${definition.id}`
    );
  }

  const result = await engine.transition({
    aggregateId: instanceId,
    transitionId: transitionId(String(transition.id)),
    actor: { type: actor.type, id: String(actor.id) },
    ...(evidence ? { evidence } : {})
  });
  if (result.status === "executed") return;
  if (result.status === "guard_failed") {
    throw new Error(
      `[loop-engine/adapter-vercel-ai] guard failed on ${String(transition.id)}: ${
        result.guardFailures?.[0]?.guardId ?? "unknown_guard"
      }`
    );
  }
  throw new Error(
    `[loop-engine/adapter-vercel-ai] transition ${String(transition.id)} returned status ${result.status}`
  );
}

// @license MIT
// SPDX-License-Identifier: MIT
import type { AggregateId, LoopId, LoopInstance, TransitionRecord } from "@loop-engine/core";
import type { LoopStore } from "@loop-engine/runtime";

export class MemoryStore implements LoopStore {
  private readonly instances = new Map<AggregateId, LoopInstance>();
  private readonly transitions = new Map<AggregateId, TransitionRecord[]>();

  async getInstance(aggregateId: AggregateId): Promise<LoopInstance | null> {
    return this.instances.get(aggregateId) ?? null;
  }

  async saveInstance(instance: LoopInstance): Promise<void> {
    this.instances.set(instance.aggregateId, instance);
  }

  async getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
    return this.transitions.get(aggregateId) ?? [];
  }

  async saveTransitionRecord(record: TransitionRecord): Promise<void> {
    const current = this.transitions.get(record.aggregateId) ?? [];
    current.push(record);
    this.transitions.set(record.aggregateId, current);
  }

  async listOpenInstances(loopId: LoopId, orgId: string): Promise<LoopInstance[]> {
    return [...this.instances.values()].filter(
      (instance) =>
        instance.loopId === loopId &&
        instance.orgId === orgId &&
        instance.status !== "CLOSED" &&
        instance.status !== "ERROR" &&
        instance.status !== "CANCELLED"
    );
  }
}

export function memoryStore(): LoopStore {
  return new MemoryStore();
}

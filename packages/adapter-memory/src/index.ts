// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type {
  AggregateId,
  LoopId,
  LoopInstance,
  TransitionRecord
} from "@loop-engine/core";
import type { LoopStore } from "@loop-engine/runtime";

export class MemoryStore implements LoopStore {
  private readonly loops = new Map<AggregateId, LoopInstance>();
  private readonly transitions = new Map<AggregateId, TransitionRecord[]>();

  async getInstance(aggregateId: AggregateId): Promise<LoopInstance | null> {
    return this.loops.get(aggregateId) ?? null;
  }

  async saveInstance(instance: LoopInstance): Promise<void> {
    this.loops.set(instance.aggregateId, instance);
  }

  async saveTransitionRecord(record: TransitionRecord): Promise<void> {
    const current = this.transitions.get(record.aggregateId) ?? [];
    current.push(record);
    this.transitions.set(record.aggregateId, current);
  }

  async getTransitionHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
    return this.transitions.get(aggregateId) ?? [];
  }

  async listOpenInstances(loopId: LoopId): Promise<LoopInstance[]> {
    return [...this.loops.values()].filter(
      (instance) => instance.loopId === loopId && instance.status === "active"
    );
  }
}

export function memoryStore(): MemoryStore {
  return new MemoryStore();
}

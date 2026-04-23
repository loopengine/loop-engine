// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AggregateId, LoopId } from "@loop-engine/core";
import type {
  LoopStore,
  RuntimeLoopInstance,
  RuntimeTransitionRecord
} from "@loop-engine/runtime";

export class MemoryStore implements LoopStore {
  private readonly loops = new Map<AggregateId, RuntimeLoopInstance>();
  private readonly transitions = new Map<AggregateId, RuntimeTransitionRecord[]>();

  async getInstance(aggregateId: AggregateId): Promise<RuntimeLoopInstance | null> {
    return this.loops.get(aggregateId) ?? null;
  }

  async saveInstance(instance: RuntimeLoopInstance): Promise<void> {
    this.loops.set(instance.aggregateId, instance);
  }

  async saveTransitionRecord(record: RuntimeTransitionRecord): Promise<void> {
    const current = this.transitions.get(record.aggregateId) ?? [];
    current.push(record);
    this.transitions.set(record.aggregateId, current);
  }

  async getTransitionHistory(aggregateId: AggregateId): Promise<RuntimeTransitionRecord[]> {
    return this.transitions.get(aggregateId) ?? [];
  }

  async listOpenInstances(loopId: LoopId): Promise<RuntimeLoopInstance[]> {
    return [...this.loops.values()].filter(
      (instance) => instance.loopId === loopId && instance.status === "active"
    );
  }
}

export function memoryStore(): MemoryStore {
  return new MemoryStore();
}

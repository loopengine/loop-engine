// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AggregateId, LoopId } from "@loop-engine/core";
import type {
  LoopStorageAdapter,
  RuntimeLoopInstance,
  RuntimeTransitionRecord
} from "@loop-engine/runtime";

export class MemoryLoopStorageAdapter implements LoopStorageAdapter {
  private readonly loops = new Map<AggregateId, RuntimeLoopInstance>();
  private readonly transitions = new Map<AggregateId, RuntimeTransitionRecord[]>();

  async getLoop(aggregateId: AggregateId): Promise<RuntimeLoopInstance | null> {
    return this.loops.get(aggregateId) ?? null;
  }

  async createLoop(instance: RuntimeLoopInstance): Promise<void> {
    this.loops.set(instance.aggregateId, instance);
  }

  async updateLoop(instance: RuntimeLoopInstance): Promise<void> {
    this.loops.set(instance.aggregateId, instance);
  }

  async appendTransition(record: RuntimeTransitionRecord): Promise<void> {
    const current = this.transitions.get(record.aggregateId) ?? [];
    current.push(record);
    this.transitions.set(record.aggregateId, current);
  }

  async getTransitions(aggregateId: AggregateId): Promise<RuntimeTransitionRecord[]> {
    return this.transitions.get(aggregateId) ?? [];
  }

  async listOpenLoops(loopId: LoopId): Promise<RuntimeLoopInstance[]> {
    return [...this.loops.values()].filter(
      (instance) => instance.loopId === loopId && instance.status === "active"
    );
  }
}

export function createMemoryLoopStorageAdapter(): LoopStorageAdapter {
  return new MemoryLoopStorageAdapter();
}

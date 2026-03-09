// @license MIT
// SPDX-License-Identifier: MIT
import type { ActorRef, AggregateId, Evidence, GuardId, LoopId, LoopInstance, TransitionId } from "@loopengine/core";

export interface GuardContext {
  loopId: LoopId;
  aggregateId: AggregateId;
  transitionId: TransitionId;
  actor: ActorRef;
  evidence: Evidence;
  currentState: string;
  instance: LoopInstance;
}

export interface GuardResult {
  passed: boolean;
  code?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export type GuardFunction = (context: GuardContext) => Promise<GuardResult>;

export interface GuardEvaluator {
  evaluate(guardId: GuardId, context: GuardContext): Promise<GuardResult>;
}

export class GuardRegistry {
  private readonly guards = new Map<GuardId, GuardFunction>();

  register(guardId: GuardId, fn: GuardFunction): void {
    this.guards.set(guardId, fn);
  }

  get(guardId: GuardId): GuardFunction | undefined {
    return this.guards.get(guardId);
  }

  createEvaluator(): GuardEvaluator {
    return {
      evaluate: async (guardId, context) => {
        const fn = this.guards.get(guardId);
        if (!fn) {
          return { passed: false, code: "guard_not_found", message: `Guard not found: ${guardId}` };
        }
        return fn(context);
      }
    };
  }
}

export function createGuardRegistry(): GuardRegistry {
  return new GuardRegistry();
}

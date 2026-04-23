// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { isAuthorized } from "@loop-engine/actors";
import type {
  ActorRef,
  AggregateId,
  GuardSpec,
  LoopDefinition,
  LoopId,
  LoopInstance,
  StateId,
  TransitionId,
  TransitionRecord
} from "@loop-engine/core";
import { GuardRegistry, evaluateGuards } from "@loop-engine/guards";
import type {
  LoopCancelledEvent,
  LoopCompletedEvent,
  LoopFailedEvent,
  LoopEvent,
  LoopStartedEvent,
  LoopTransitionBlockedEvent,
  LoopTransitionExecutedEvent,
  LoopTransitionRequestedEvent,
  LoopGuardFailedEvent
} from "@loop-engine/events";
import {
  createLoopCancelledEvent,
  createLoopCompletedEvent,
  createLoopFailedEvent,
  createLoopGuardFailedEvent,
  createLoopStartedEvent,
  createLoopTransitionBlockedEvent,
  createLoopTransitionExecutedEvent,
  createLoopTransitionRequestedEvent
} from "@loop-engine/events";
import type { LoopEngineOptions } from "./interfaces";

export interface StartLoopParams {
  loopId: LoopDefinition["loopId"];
  aggregateId: AggregateId;
  actor: ActorRef;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionParams {
  aggregateId: AggregateId;
  transitionId: TransitionId;
  actor: ActorRef;
  evidence?: Record<string, unknown>;
  correlationId?: string;
}

export interface TransitionResult {
  status: "executed" | "guard_failed" | "rejected";
  fromState: StateId;
  toState?: StateId;
  guardFailures?: { guardId: GuardSpec["guardId"]; message: string; severity: "hard" | "soft" }[];
  rejectionReason?: string;
  event?:
    | LoopTransitionExecutedEvent
    | LoopTransitionBlockedEvent
    | LoopCancelledEvent
    | LoopFailedEvent;
}

function generateEventId(): string {
  return crypto.randomUUID();
}

function createDefaultGuardRegistry(): GuardRegistry {
  const registry = new GuardRegistry();
  registry.registerBuiltIns();
  return registry;
}

export class LoopEngine {
  private readonly options: LoopEngineOptions;
  private readonly guards: GuardRegistry;

  constructor(options: LoopEngineOptions) {
    this.options = options;
    this.guards = options.guardRegistry ?? createDefaultGuardRegistry();
  }

  private now(): string {
    return this.options.now ? this.options.now() : new Date().toISOString();
  }

  private async emit(event: LoopEvent): Promise<void> {
    if (this.options.eventBus) {
      await this.options.eventBus.emit(event);
    }
  }

  private isTerminal(definition: LoopDefinition, stateId: StateId): boolean {
    return definition.states.some((state) => state.stateId === stateId && state.terminal === true);
  }

  async start(params: StartLoopParams): Promise<LoopInstance> {
    const definition = this.options.registry.get(params.loopId);
    if (!definition) {
      throw new Error(`Loop definition not found for ${params.loopId}`);
    }

    const existing = await this.options.store.getInstance(params.aggregateId);
    if (existing && existing.status === "active") {
      throw new Error(`Active loop already exists for aggregateId ${params.aggregateId}`);
    }

    const now = this.now();
    const instance: LoopInstance = {
      loopId: definition.loopId,
      aggregateId: params.aggregateId,
      currentState: definition.initialState,
      status: "active",
      startedAt: now,
      updatedAt: now,
      ...(params.correlationId ? { correlationId: params.correlationId } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {})
    };
    await this.options.store.saveInstance(instance);

    const event: LoopStartedEvent = createLoopStartedEvent({
      loopId: definition.loopId,
      aggregateId: params.aggregateId,
      correlationId: params.correlationId,
      initialState: definition.initialState,
      actor: params.actor,
      definition: {
        loopId: definition.loopId,
        version: definition.version,
        name: definition.name
      }
    });
    await this.emit(event);

    return instance;
  }

  async transition(params: TransitionParams): Promise<TransitionResult> {
    const instance = await this.options.store.getInstance(params.aggregateId);
    if (!instance) {
      throw new Error(`Loop instance not found for aggregateId ${params.aggregateId}`);
    }

    const definition = this.options.registry.get(instance.loopId);
    if (!definition) {
      throw new Error(`Loop definition not found for ${instance.loopId}`);
    }

    if (instance.status === "completed" || this.isTerminal(definition, instance.currentState)) {
      return {
        status: "rejected",
        fromState: instance.currentState,
        rejectionReason: "loop_closed"
      };
    }

    const transition = definition.transitions.find(
      (candidate) =>
        candidate.transitionId === params.transitionId &&
        candidate.from === instance.currentState
    );
    if (!transition) {
      return {
        status: "rejected",
        fromState: instance.currentState,
        rejectionReason: "invalid_transition"
      };
    }

    const authorization = isAuthorized(params.actor, transition);
    if (!authorization.authorized) {
      return {
        status: "rejected",
        fromState: instance.currentState,
        rejectionReason: "unauthorized_actor"
      };
    }

    const evidence = params.evidence ?? {};
    const requestedEvent: LoopTransitionRequestedEvent = createLoopTransitionRequestedEvent({
      loopId: instance.loopId,
      aggregateId: instance.aggregateId,
      correlationId: params.correlationId ?? instance.correlationId,
      transitionId: transition.transitionId,
      fromState: instance.currentState,
      toState: transition.to,
      signal: transition.signal,
      actor: params.actor,
      evidence
    });
    await this.emit(requestedEvent);

    const guardSummary = await evaluateGuards(
      transition.guards ?? [],
      {
        actor: params.actor,
        loopId: instance.loopId,
        aggregateId: instance.aggregateId,
        fromState: instance.currentState,
        toState: transition.to,
        signal: transition.signal,
        evidence,
        ...(instance.metadata ? { loopData: instance.metadata } : {})
      },
      this.guards
    );

    for (const failure of guardSummary.softFailures) {
      const warningEvent: LoopGuardFailedEvent = createLoopGuardFailedEvent({
        loopId: instance.loopId,
        aggregateId: instance.aggregateId,
        correlationId: params.correlationId ?? instance.correlationId,
        transitionId: transition.transitionId,
        fromState: instance.currentState,
        guardId: failure.guardId,
        severity: "soft",
        actor: params.actor,
        message: failure.message,
        metadata: failure.metadata
      });
      await this.emit(warningEvent);
    }

    if (!guardSummary.allPassed) {
      for (const failure of guardSummary.hardFailures) {
        const failedEvent: LoopGuardFailedEvent = createLoopGuardFailedEvent({
          loopId: instance.loopId,
          aggregateId: instance.aggregateId,
          correlationId: params.correlationId ?? instance.correlationId,
          transitionId: transition.transitionId,
          fromState: instance.currentState,
          guardId: failure.guardId,
          severity: "hard",
          actor: params.actor,
          message: failure.message,
          metadata: failure.metadata
        });
        await this.emit(failedEvent);
      }

      const blockedEvent: LoopTransitionBlockedEvent = createLoopTransitionBlockedEvent({
        loopId: instance.loopId,
        aggregateId: instance.aggregateId,
        correlationId: params.correlationId ?? instance.correlationId,
        transitionId: transition.transitionId,
        fromState: instance.currentState,
        attemptedToState: transition.to,
        actor: params.actor,
        guardFailures: guardSummary.hardFailures.map((failure) => ({
          guardId: failure.guardId,
          message: failure.message
        }))
      });
      await this.emit(blockedEvent);

      return {
        status: "guard_failed",
        fromState: instance.currentState,
        guardFailures: guardSummary.hardFailures.map((failure) => ({
          guardId: failure.guardId,
          message: failure.message,
          severity: "hard" as const
        })),
        event: blockedEvent
      };
    }

    const now = this.now();
    const updated: LoopInstance = {
      ...instance,
      currentState: transition.to,
      updatedAt: now
    };
    if (this.isTerminal(definition, transition.to)) {
      updated.status = "completed";
      updated.completedAt = now;
    }
    await this.options.store.saveInstance(updated);

    const record: TransitionRecord = {
      aggregateId: updated.aggregateId,
      loopId: updated.loopId,
      transitionId: transition.transitionId,
      signal: transition.signal,
      fromState: instance.currentState,
      toState: transition.to,
      actor: params.actor,
      occurredAt: now,
      evidence: {
        ...evidence,
        ...(guardSummary.softFailures.length > 0
          ? {
              _softGuardWarnings: guardSummary.softFailures.map((failure) => ({
                guardId: failure.guardId,
                message: failure.message
              }))
            }
          : {})
      }
    };
    await this.options.store.saveTransitionRecord(record);
    const history = await this.options.store.getTransitionHistory(updated.aggregateId);

    const transitionEvent: LoopTransitionExecutedEvent = createLoopTransitionExecutedEvent({
      loopId: updated.loopId,
      aggregateId: updated.aggregateId,
      correlationId: params.correlationId ?? updated.correlationId,
      transitionId: transition.transitionId,
      fromState: instance.currentState,
      toState: transition.to,
      signal: transition.signal,
      actor: record.actor,
      evidence: record.evidence,
      softGuardWarnings: guardSummary.softFailures.map((failure) => ({
        guardId: failure.guardId,
        message: failure.message
      }))
    });
    await this.emit(transitionEvent);

    if (updated.status === "completed") {
      const completedEvent: LoopCompletedEvent = createLoopCompletedEvent({
        loopId: updated.loopId,
        aggregateId: updated.aggregateId,
        correlationId: params.correlationId ?? updated.correlationId,
        finalState: updated.currentState,
        actor: record.actor,
        durationMs: Math.max(0, Date.parse(now) - Date.parse(updated.startedAt)),
        outcome: definition.outcome
          ? {
              valueUnit: definition.outcome.valueUnit,
              metrics: {}
            }
          : undefined
      });
      await this.emit(completedEvent);
    }

    return {
      status: "executed",
      fromState: instance.currentState,
      toState: transition.to,
      ...(guardSummary.softFailures.length > 0
        ? {
            guardFailures: guardSummary.softFailures.map((failure) => ({
              guardId: failure.guardId,
              message: failure.message,
              severity: "soft" as const
            }))
          }
        : {}),
      event: transitionEvent
    };
  }

  async cancelLoop(aggregateId: AggregateId, actor: ActorRef, reason?: string): Promise<LoopCancelledEvent> {
    const instance = await this.options.store.getInstance(aggregateId);
    if (!instance) {
      throw new Error(`Loop instance not found for aggregateId ${aggregateId}`);
    }
    const now = this.now();
    const updated: LoopInstance = {
      ...instance,
      status: "cancelled",
      completedAt: now,
      updatedAt: now
    };
    await this.options.store.saveInstance(updated);
    const event = createLoopCancelledEvent({
      loopId: updated.loopId,
      aggregateId: updated.aggregateId,
      correlationId: updated.correlationId,
      fromState: instance.currentState,
      actor,
      reason
    });
    await this.emit(event);
    return event;
  }

  async failLoop(
    aggregateId: AggregateId,
    fromState: StateId,
    error: { code: string; message: string; stack?: string }
  ): Promise<LoopFailedEvent> {
    const instance = await this.options.store.getInstance(aggregateId);
    if (!instance) {
      throw new Error(`Loop instance not found for aggregateId ${aggregateId}`);
    }
    const now = this.now();
    const updated: LoopInstance = {
      ...instance,
      status: "failed",
      completedAt: now,
      updatedAt: now
    };
    await this.options.store.saveInstance(updated);
    const event = createLoopFailedEvent({
      loopId: updated.loopId,
      aggregateId: updated.aggregateId,
      correlationId: updated.correlationId,
      fromState,
      error
    });
    await this.emit(event);
    return event;
  }

  async getState(aggregateId: AggregateId): Promise<LoopInstance | null> {
    return this.options.store.getInstance(aggregateId);
  }

  async getHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
    return this.options.store.getTransitionHistory(aggregateId);
  }

  async listOpen(loopId: LoopId): Promise<LoopInstance[]> {
    return this.options.store.listOpenInstances(loopId);
  }
}

export function createLoopEngine(options: LoopEngineOptions): LoopEngine {
  return new LoopEngine(options);
}

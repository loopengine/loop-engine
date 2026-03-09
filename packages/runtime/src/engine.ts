// @license MIT
// SPDX-License-Identifier: MIT
import { canActorExecuteTransition } from "@loop-engine/actors";
import type {
  ActorId,
  AggregateId,
  CorrelationId,
  Evidence,
  GuardId,
  LoopInstance,
  LoopStatus,
  StateId,
  TransitionId,
  TransitionRecord
} from "@loop-engine/core";
import { correlationId as toCorrelationId } from "@loop-engine/core";
import type {
  GuardFailedEvent,
  LoopCompletedEvent,
  LoopEvent,
  LoopStartedEvent,
  TransitionExecutedEvent
} from "@loop-engine/events";
import type { GuardContext, LoopEngineOptions } from "./interfaces";

export interface StartOptions {
  loopId: string;
  aggregateId: AggregateId;
  orgId: string;
  actor: { type: "human" | "automation" | "ai-agent" | "webhook" | "system"; id: string };
  correlationId?: CorrelationId;
  metadata?: Record<string, unknown>;
}

export interface TransitionOptions {
  aggregateId: AggregateId;
  transitionId: TransitionId;
  actor: { type: "human" | "automation" | "ai-agent" | "webhook" | "system"; id: string };
  evidence?: Evidence;
  correlationId?: CorrelationId;
}

export interface TransitionResult {
  status: "executed" | "guard_failed" | "rejected" | "pending_approval";
  fromState: StateId;
  toState?: StateId;
  guardFailures?: { guardId: GuardId; message: string; severity: "hard" | "soft" }[];
  rejectionReason?: string;
  requiresApprovalFrom?: ActorId;
  event?: TransitionExecutedEvent | GuardFailedEvent;
}

type SideEffectHandler = (params: {
  aggregateId: AggregateId;
  transitionId: TransitionId;
  evidence: Evidence;
}) => Promise<void> | void;

function id(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function statusForState(isTerminal: boolean, isError: boolean): LoopStatus {
  if (isError) return "ERROR";
  if (isTerminal) return "CLOSED";
  return "IN_PROGRESS";
}

export class LoopEngine {
  private readonly opts: LoopEngineOptions;
  private readonly sideEffectHandlers = new Map<string, SideEffectHandler>();

  constructor(options: LoopEngineOptions) {
    this.opts = options;
  }

  registerSideEffectHandler(sideEffectId: string, handler: SideEffectHandler): void {
    this.sideEffectHandlers.set(sideEffectId, handler);
  }

  private now(): string {
    return this.opts.clock ? this.opts.clock() : new Date().toISOString();
  }

  private async emit(event: LoopEvent): Promise<void> {
    if (this.opts.eventBus) {
      await this.opts.eventBus.emit(event);
    }
  }

  async start(options: StartOptions): Promise<LoopInstance> {
    const definition = this.opts.registry.get(options.loopId as never);
    if (!definition) {
      throw new Error(`loopId not found: ${options.loopId}`);
    }

    const existing = await this.opts.store.getInstance(options.aggregateId);
    if (existing && existing.status !== "CLOSED" && existing.status !== "ERROR" && existing.status !== "CANCELLED") {
      throw new Error(`OPEN instance already exists for aggregateId ${options.aggregateId}`);
    }

    const now = this.now();
    const instance: LoopInstance = {
      loopId: definition.id,
      aggregateId: options.aggregateId,
      orgId: options.orgId,
      currentState: definition.initialState,
      status: "OPEN",
      startedAt: now,
      correlationId: options.correlationId ?? toCorrelationId(id()),
      ...(options.metadata ? { metadata: options.metadata } : {})
    };
    await this.opts.store.saveInstance(instance);

    const event: LoopStartedEvent = {
      type: "loop.started",
      eventId: id(),
      loopId: definition.id,
      aggregateId: options.aggregateId,
      orgId: options.orgId,
      occurredAt: now,
      correlationId: instance.correlationId,
      initialState: definition.initialState,
      actor: { type: options.actor.type, id: options.actor.id as never }
    };
    await this.emit(event as LoopEvent);
    return instance;
  }

  async transition(options: TransitionOptions): Promise<TransitionResult> {
    const instance = await this.opts.store.getInstance(options.aggregateId);
    if (!instance) {
      throw new Error(`instance not found for ${options.aggregateId}`);
    }
    const definition = this.opts.registry.get(instance.loopId);
    if (!definition) {
      throw new Error(`definition not found for ${instance.loopId}`);
    }

    const state = definition.states.find((s) => s.id === instance.currentState);
    if (state?.isTerminal || state?.isError || instance.status === "CLOSED" || instance.status === "ERROR") {
      return {
        status: "rejected",
        fromState: instance.currentState,
        rejectionReason: "loop_closed"
      };
    }

    const transition = definition.transitions.find(
      (t) => t.id === options.transitionId && t.from === instance.currentState
    );
    if (!transition) {
      return {
        status: "rejected",
        fromState: instance.currentState,
        rejectionReason: "invalid_transition"
      };
    }

    const auth = canActorExecuteTransition(
      {
        type: options.actor.type,
        id: options.actor.id as never
      } as never,
      transition
    );
    if (!auth.authorized) {
      return {
        status: auth.requiresApproval ? "pending_approval" : "rejected",
        fromState: instance.currentState,
        ...(auth.reason ? { rejectionReason: auth.reason } : {}),
        ...(auth.requiresApproval ? { requiresApprovalFrom: "human-approver" as ActorId } : {})
      };
    }

    const evidence: Evidence = options.evidence ?? {};
    const hardFailures: { guardId: GuardId; message: string; severity: "hard" | "soft" }[] = [];
    const softFailures: { guardId: GuardId; message: string; severity: "hard" | "soft" }[] = [];
    for (const guard of transition.guards ?? []) {
      if (!this.opts.guardEvaluator) break;
      const ctx: GuardContext = {
        loopId: instance.loopId,
        aggregateId: instance.aggregateId,
        transitionId: transition.id,
        actor: { type: options.actor.type, id: options.actor.id as never },
        evidence,
        currentState: instance.currentState,
        instance
      };
      const result = await this.opts.guardEvaluator.evaluate(guard.id, ctx);
      if (!result.passed) {
        const failure = {
          guardId: guard.id,
          message: result.message ?? guard.failureMessage,
          severity: guard.severity
        } as const;
        if (guard.severity === "hard") {
          hardFailures.push(failure);
          break;
        } else {
          softFailures.push(failure);
        }
      }
    }

    if (hardFailures.length > 0) {
      const failure = hardFailures[0];
      if (!failure) {
        return { status: "guard_failed", fromState: instance.currentState, guardFailures: hardFailures };
      }
      const event: GuardFailedEvent = {
        type: "loop.guard.failed",
        eventId: id(),
        loopId: instance.loopId,
        aggregateId: instance.aggregateId,
        orgId: instance.orgId,
        occurredAt: this.now(),
        correlationId: options.correlationId ?? instance.correlationId,
        fromState: instance.currentState,
        attemptedTransitionId: transition.id,
        guardId: failure.guardId,
        guardFailureMessage: failure.message,
        severity: "hard",
        actor: { type: options.actor.type, id: options.actor.id as never }
      };
      await this.emit(event as LoopEvent);
      return {
        status: "guard_failed",
        fromState: instance.currentState,
        guardFailures: hardFailures,
        event
      };
    }

    const now = this.now();
    const previousState = instance.currentState;
    instance.currentState = transition.to;
    const toStateSpec = definition.states.find((s) => s.id === transition.to);
    instance.status = statusForState(Boolean(toStateSpec?.isTerminal), Boolean(toStateSpec?.isError));
    if (instance.status === "CLOSED" || instance.status === "ERROR") {
      instance.closedAt = now;
    }

    const history = await this.opts.store.getTransitionHistory(options.aggregateId);
    const last = history[history.length - 1];
    const durationMs = last ? Math.max(0, Date.parse(now) - Date.parse(last.occurredAt)) : undefined;
    const record: TransitionRecord = {
      id: id(),
      loopId: instance.loopId,
      aggregateId: instance.aggregateId,
      transitionId: transition.id,
      fromState: previousState,
      toState: transition.to,
      actor: { type: options.actor.type, id: options.actor.id as never },
      evidence: {
        ...evidence,
        ...(softFailures.length > 0 ? { _softGuardWarnings: softFailures } : {})
      },
      occurredAt: now,
      ...(durationMs !== undefined ? { durationMs } : {})
    };
    await this.opts.store.saveTransitionRecord(record);
    await this.opts.store.saveInstance(instance);

    const transitionEvent: TransitionExecutedEvent = {
      type: "loop.transition.executed",
      eventId: id(),
      loopId: instance.loopId,
      aggregateId: instance.aggregateId,
      orgId: instance.orgId,
      occurredAt: now,
      correlationId: options.correlationId ?? instance.correlationId,
      fromState: previousState,
      toState: transition.to,
      transitionId: transition.id,
      actor: record.actor,
      evidence: record.evidence,
      ...(durationMs !== undefined ? { durationMs } : {})
    };
    await this.emit(transitionEvent as LoopEvent);

    if (instance.status === "CLOSED") {
      const completedEvent: LoopCompletedEvent = {
        type: "loop.completed",
        eventId: id(),
        loopId: instance.loopId,
        aggregateId: instance.aggregateId,
        orgId: instance.orgId,
        occurredAt: now,
        correlationId: options.correlationId ?? instance.correlationId,
        terminalState: instance.currentState,
        actor: record.actor,
        durationMs: Math.max(0, Date.parse(now) - Date.parse(instance.startedAt)),
        transitionCount: history.length + 1,
        outcomeId: definition.outcome.id,
        valueUnit: definition.outcome.valueUnit
      };
      await this.emit(completedEvent as LoopEvent);
    }

    for (const sideEffect of transition.sideEffects ?? []) {
      const handler = this.sideEffectHandlers.get(sideEffect.id);
      if (handler) {
        await handler({
          aggregateId: instance.aggregateId,
          transitionId: transition.id,
          evidence: record.evidence
        });
      }
    }

    return {
      status: "executed",
      fromState: previousState,
      toState: transition.to,
      ...(softFailures.length > 0 ? { guardFailures: softFailures } : {}),
      event: transitionEvent
    };
  }

  async getState(aggregateId: AggregateId): Promise<LoopInstance | null> {
    return this.opts.store.getInstance(aggregateId);
  }

  async getHistory(aggregateId: AggregateId): Promise<TransitionRecord[]> {
    return this.opts.store.getTransitionHistory(aggregateId);
  }

  async listOpen(loopId: string, orgId: string): Promise<LoopInstance[]> {
    return this.opts.store.listOpenInstances(loopId as never, orgId);
  }
}

export function createLoopEngine(options: LoopEngineOptions): LoopEngine {
  return new LoopEngine(options);
}

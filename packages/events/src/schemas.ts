// @license MIT
// SPDX-License-Identifier: MIT
import { z } from "zod";

const BaseSchema = z.object({
  eventId: z.string().min(1),
  loopId: z.string().min(1),
  aggregateId: z.string().min(1),
  orgId: z.string().min(1),
  occurredAt: z.string().min(1),
  correlationId: z.string().min(1),
  causationId: z.string().optional()
});

const ActorSchema = z.object({
  type: z.enum(["human", "automation", "ai-agent", "webhook", "system"]),
  id: z.string().min(1)
});

const EvidenceSchema = z.record(z.unknown());

export const LoopStartedEventSchema = BaseSchema.extend({
  type: z.literal("loop.started"),
  initialState: z.string().min(1),
  actor: ActorSchema
});

export const TransitionRequestedEventSchema = BaseSchema.extend({
  type: z.literal("loop.transition.requested"),
  transitionId: z.string().min(1),
  actor: ActorSchema,
  evidence: EvidenceSchema,
  requestedAt: z.string().min(1)
});

export const TransitionExecutedEventSchema = BaseSchema.extend({
  type: z.literal("loop.transition.executed"),
  fromState: z.string().min(1),
  toState: z.string().min(1),
  transitionId: z.string().min(1),
  actor: ActorSchema,
  evidence: EvidenceSchema,
  durationMs: z.number().optional()
});

export const TransitionBlockedEventSchema = BaseSchema.extend({
  type: z.literal("loop.transition.blocked"),
  transitionId: z.string().min(1),
  reason: z.enum(["guard_failed", "unauthorized_actor", "invalid_transition", "loop_closed"]),
  actor: ActorSchema,
  guardFailures: z.array(z.object({ guardId: z.string(), message: z.string() })).optional()
});

export const GuardFailedEventSchema = BaseSchema.extend({
  type: z.literal("loop.guard.failed"),
  fromState: z.string().min(1),
  attemptedTransitionId: z.string().min(1),
  guardId: z.string().min(1),
  guardFailureMessage: z.string().min(1),
  severity: z.enum(["hard", "soft"]).optional(),
  actor: ActorSchema
});

export const LoopCompletedEventSchema = BaseSchema.extend({
  type: z.literal("loop.completed"),
  terminalState: z.string().min(1),
  actor: ActorSchema,
  durationMs: z.number(),
  transitionCount: z.number().int().nonnegative(),
  outcomeId: z.string().min(1),
  valueUnit: z.string().min(1)
});

export const LoopErrorEventSchema = BaseSchema.extend({
  type: z.literal("loop.error"),
  errorState: z.string().min(1),
  errorCode: z.string().min(1),
  errorMessage: z.string().min(1),
  actor: ActorSchema
});

export const LoopSpawnedEventSchema = BaseSchema.extend({
  type: z.literal("loop.spawned"),
  parentAggregateId: z.string().min(1),
  childLoopId: z.string().min(1),
  childAggregateId: z.string().min(1)
});

export const SignalReceivedEventSchema = BaseSchema.extend({
  type: z.literal("loop.signal.received"),
  signalType: z.string().min(1),
  confidence: z.number(),
  triggeredLoopId: z.string().optional()
});

export const OutcomeRecordedEventSchema = BaseSchema.extend({
  type: z.literal("loop.outcome.recorded"),
  outcomeId: z.string().min(1),
  valueUnit: z.string().min(1),
  businessMetrics: z.record(z.unknown()).optional(),
  durationMs: z.number()
});

export const LoopEventSchema = z.discriminatedUnion("type", [
  LoopStartedEventSchema,
  TransitionRequestedEventSchema,
  TransitionExecutedEventSchema,
  TransitionBlockedEventSchema,
  GuardFailedEventSchema,
  LoopCompletedEventSchema,
  LoopErrorEventSchema,
  LoopSpawnedEventSchema,
  SignalReceivedEventSchema,
  OutcomeRecordedEventSchema
]);

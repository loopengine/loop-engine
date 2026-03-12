// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import {
  ActorRefSchema as CoreActorRefSchema,
  AggregateIdSchema,
  GuardIdSchema,
  GuardSeveritySchema,
  LoopIdSchema,
  SignalIdSchema,
  StateIdSchema,
  TransitionIdSchema
} from "@loop-engine/core";

export const BaseLoopEventSchema = z.object({
  eventId: z.string().uuid(),
  type: z.string(),
  loopId: LoopIdSchema,
  aggregateId: AggregateIdSchema,
  occurredAt: z.string().datetime(),
  correlationId: z.string().optional(),
  causationId: z.string().optional()
});

const ActorRefSchema = CoreActorRefSchema;

const GuardFailureSchema = z.object({
  guardId: GuardIdSchema,
  message: z.string().min(1)
});

export const LoopStartedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.started"),
  initialState: StateIdSchema,
  actor: ActorRefSchema,
  definition: z.object({
    loopId: LoopIdSchema,
    version: z.string().min(1),
    name: z.string().min(1)
  })
});

export const LoopCompletedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.completed"),
  finalState: StateIdSchema,
  actor: ActorRefSchema,
  durationMs: z.number().nonnegative(),
  outcome: z
    .object({
      valueUnit: z.string().min(1),
      metrics: z.record(z.unknown())
    })
    .optional()
});

export const LoopCancelledEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.cancelled"),
  fromState: StateIdSchema,
  actor: ActorRefSchema,
  reason: z.string().optional()
});

export const LoopFailedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.failed"),
  fromState: StateIdSchema,
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().optional()
  })
});

export const LoopTransitionRequestedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.transition.requested"),
  transitionId: TransitionIdSchema,
  fromState: StateIdSchema,
  toState: StateIdSchema,
  signal: SignalIdSchema,
  actor: ActorRefSchema,
  evidence: z.record(z.unknown()).optional()
});

export const LoopTransitionExecutedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.transition.executed"),
  transitionId: TransitionIdSchema,
  fromState: StateIdSchema,
  toState: StateIdSchema,
  signal: SignalIdSchema,
  actor: ActorRefSchema,
  evidence: z.record(z.unknown()).optional(),
  softGuardWarnings: z.array(GuardFailureSchema).optional()
});

export const LoopTransitionBlockedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.transition.blocked"),
  transitionId: TransitionIdSchema,
  fromState: StateIdSchema,
  attemptedToState: StateIdSchema,
  actor: ActorRefSchema,
  guardFailures: z.array(GuardFailureSchema)
});

export const LoopGuardFailedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.guard.failed"),
  transitionId: TransitionIdSchema,
  fromState: StateIdSchema,
  guardId: GuardIdSchema,
  severity: GuardSeveritySchema,
  actor: ActorRefSchema,
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

export const LoopSignalReceivedEventSchema = BaseLoopEventSchema.extend({
  type: z.literal("loop.signal.received"),
  signal: SignalIdSchema,
  fromState: StateIdSchema,
  actor: ActorRefSchema,
  payload: z.record(z.unknown()).optional()
});

export const LoopEventSchema = z.discriminatedUnion("type", [
  LoopStartedEventSchema,
  LoopCompletedEventSchema,
  LoopCancelledEventSchema,
  LoopFailedEventSchema,
  LoopTransitionRequestedEventSchema,
  LoopTransitionExecutedEventSchema,
  LoopTransitionBlockedEventSchema,
  LoopGuardFailedEventSchema,
  LoopSignalReceivedEventSchema
]);

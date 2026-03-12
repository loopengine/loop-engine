// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type {
  LoopCancelledEvent,
  LoopCompletedEvent,
  LoopFailedEvent,
  LoopGuardFailedEvent,
  LoopSignalReceivedEvent,
  LoopStartedEvent,
  LoopTransitionBlockedEvent,
  LoopTransitionExecutedEvent,
  LoopTransitionRequestedEvent
} from "./events";
import {
  LoopCancelledEventSchema,
  LoopCompletedEventSchema,
  LoopFailedEventSchema,
  LoopGuardFailedEventSchema,
  LoopSignalReceivedEventSchema,
  LoopStartedEventSchema,
  LoopTransitionBlockedEventSchema,
  LoopTransitionExecutedEventSchema,
  LoopTransitionRequestedEventSchema
} from "./schemas";

function buildBase<T extends Record<string, unknown>>(
  payload: T
): T & { eventId: string; occurredAt: string } {
  return {
    ...payload,
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString()
  };
}

export function createLoopStartedEvent(
  params: Omit<LoopStartedEvent, "type" | "eventId" | "occurredAt">
): LoopStartedEvent {
  const event = buildBase({ ...params, type: "loop.started" as const });
  return LoopStartedEventSchema.parse(event);
}

export function createLoopCompletedEvent(
  params: Omit<LoopCompletedEvent, "type" | "eventId" | "occurredAt">
): LoopCompletedEvent {
  const event = buildBase({ ...params, type: "loop.completed" as const });
  return LoopCompletedEventSchema.parse(event);
}

export function createLoopCancelledEvent(
  params: Omit<LoopCancelledEvent, "type" | "eventId" | "occurredAt">
): LoopCancelledEvent {
  const event = buildBase({ ...params, type: "loop.cancelled" as const });
  return LoopCancelledEventSchema.parse(event);
}

export function createLoopFailedEvent(
  params: Omit<LoopFailedEvent, "type" | "eventId" | "occurredAt">
): LoopFailedEvent {
  const event = buildBase({ ...params, type: "loop.failed" as const });
  return LoopFailedEventSchema.parse(event);
}

export function createLoopTransitionRequestedEvent(
  params: Omit<LoopTransitionRequestedEvent, "type" | "eventId" | "occurredAt">
): LoopTransitionRequestedEvent {
  const event = buildBase({ ...params, type: "loop.transition.requested" as const });
  return LoopTransitionRequestedEventSchema.parse(event);
}

export function createLoopTransitionExecutedEvent(
  params: Omit<LoopTransitionExecutedEvent, "type" | "eventId" | "occurredAt">
): LoopTransitionExecutedEvent {
  const event = buildBase({ ...params, type: "loop.transition.executed" as const });
  return LoopTransitionExecutedEventSchema.parse(event);
}

export function createLoopTransitionBlockedEvent(
  params: Omit<LoopTransitionBlockedEvent, "type" | "eventId" | "occurredAt">
): LoopTransitionBlockedEvent {
  const event = buildBase({ ...params, type: "loop.transition.blocked" as const });
  return LoopTransitionBlockedEventSchema.parse(event);
}

export function createLoopGuardFailedEvent(
  params: Omit<LoopGuardFailedEvent, "type" | "eventId" | "occurredAt">
): LoopGuardFailedEvent {
  const event = buildBase({ ...params, type: "loop.guard.failed" as const });
  return LoopGuardFailedEventSchema.parse(event);
}

export function createLoopSignalReceivedEvent(
  params: Omit<LoopSignalReceivedEvent, "type" | "eventId" | "occurredAt">
): LoopSignalReceivedEvent {
  const event = buildBase({ ...params, type: "loop.signal.received" as const });
  return LoopSignalReceivedEventSchema.parse(event);
}

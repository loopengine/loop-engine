// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { LoopDefinitionSchema } from "@loop-engine/core";
import {
  createLoopGuardFailedEvent,
  createLoopStartedEvent,
  extractLearningSignal,
  LoopEventSchema
} from "..";

const now = new Date().toISOString();
const eventBase = {
  eventId: crypto.randomUUID(),
  loopId: "support.ticket",
  aggregateId: "ticket-1",
  occurredAt: now,
  correlationId: "corr-1"
};
const actor = { id: "actor-1", type: "human" as const };

describe("events package", () => {
  it("LoopEventSchema parses each of the 9 event types", () => {
    const samples = [
      {
        ...eventBase,
        type: "loop.started",
        initialState: "OPEN",
        actor,
        definition: { loopId: "support.ticket", version: "1.0.0", name: "Support Ticket" }
      },
      {
        ...eventBase,
        type: "loop.completed",
        finalState: "RESOLVED",
        actor,
        durationMs: 86_400_000
      },
      {
        ...eventBase,
        type: "loop.cancelled",
        fromState: "OPEN",
        actor
      },
      {
        ...eventBase,
        type: "loop.failed",
        fromState: "OPEN",
        error: { code: "ERR_TEST", message: "failed" }
      },
      {
        ...eventBase,
        type: "loop.transition.requested",
        transitionId: "resolve",
        fromState: "OPEN",
        toState: "RESOLVED",
        signal: "support.ticket.resolve",
        actor
      },
      {
        ...eventBase,
        type: "loop.transition.executed",
        transitionId: "resolve",
        fromState: "OPEN",
        toState: "RESOLVED",
        signal: "support.ticket.resolve",
        actor
      },
      {
        ...eventBase,
        type: "loop.transition.blocked",
        transitionId: "resolve",
        fromState: "OPEN",
        attemptedToState: "RESOLVED",
        actor,
        guardFailures: [{ guardId: "confidence", message: "too low" }]
      },
      {
        ...eventBase,
        type: "loop.guard.failed",
        transitionId: "resolve",
        fromState: "OPEN",
        guardId: "confidence",
        severity: "hard",
        actor,
        message: "too low"
      },
      {
        ...eventBase,
        type: "loop.signal.received",
        signal: "support.ticket.resolve",
        fromState: "OPEN",
        actor
      }
    ];

    for (const sample of samples) {
      expect(LoopEventSchema.safeParse(sample).success).toBe(true);
    }
  });

  it("extractLearningSignal filters predicted metric ids only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const completed = {
      ...eventBase,
      type: "loop.completed" as const,
      finalState: "RESOLVED",
      actor,
      durationMs: 172_800_000
    };
    const history = [
      {
        ...eventBase,
        type: "loop.transition.executed" as const,
        transitionId: "triage",
        fromState: "OPEN",
        toState: "IN_REVIEW",
        signal: "support.ticket.triage",
        actor
      }
    ];
    const definition = LoopDefinitionSchema.parse({
      id: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Ticket loop",
      states: [
        { id: "OPEN", label: "Open" },
        { id: "RESOLVED", label: "Resolved", isTerminal: true }
      ],
      initialState: "OPEN",
      transitions: [
        {
          id: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          actors: ["human"]
        }
      ],
      outcome: {
        description: "Ticket resolved",
        valueUnit: "ticket_resolution",
        businessMetrics: [
          { id: "cycle_time_days", label: "Cycle Time", unit: "days" }
        ]
      }
    });

    const signal = extractLearningSignal(completed, history, definition, {
      cycle_time_days: 3,
      unknown_metric: 99
    });
    expect(signal.predicted?.cycle_time_days).toBe(3);
    expect(signal.predicted?.unknown_metric).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("extractLearningSignal computes cycle_time_days from durationMs", () => {
    const completed = {
      ...eventBase,
      type: "loop.completed" as const,
      finalState: "RESOLVED",
      actor,
      durationMs: 259_200_000
    };
    const definition = LoopDefinitionSchema.parse({
      id: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Ticket loop",
      states: [
        { id: "OPEN", label: "Open" },
        { id: "RESOLVED", label: "Resolved", isTerminal: true }
      ],
      initialState: "OPEN",
      transitions: [
        {
          id: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          actors: ["human"]
        }
      ],
      outcome: {
        description: "Ticket resolved",
        valueUnit: "ticket_resolution",
        businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }]
      }
    });

    const signal = extractLearningSignal(completed, [], definition);
    expect(signal.actual?.cycle_time_days).toBe(3);
  });

  it("createLoopStartedEvent produces valid LoopStartedEvent", () => {
    const event = createLoopStartedEvent({
      loopId: "support.ticket",
      aggregateId: "ticket-1",
      correlationId: "corr-1",
      initialState: "OPEN",
      actor,
      definition: { loopId: "support.ticket", version: "1.0.0", name: "Support Ticket" }
    });
    expect(LoopEventSchema.safeParse(event).success).toBe(true);
  });

  it('createLoopGuardFailedEvent with severity "hard" produces valid shape', () => {
    const event = createLoopGuardFailedEvent({
      loopId: "support.ticket",
      aggregateId: "ticket-1",
      correlationId: "corr-1",
      transitionId: "resolve",
      fromState: "OPEN",
      guardId: "confidence",
      severity: "hard",
      actor,
      message: "too low"
    });
    expect(LoopEventSchema.safeParse(event).success).toBe(true);
  });

  it("unknown predicted key warns but does not throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const completed = {
      ...eventBase,
      type: "loop.completed" as const,
      finalState: "RESOLVED",
      actor,
      durationMs: 86_400_000
    };
    const definition = LoopDefinitionSchema.parse({
      id: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Ticket loop",
      states: [
        { id: "OPEN", label: "Open" },
        { id: "RESOLVED", label: "Resolved", isTerminal: true }
      ],
      initialState: "OPEN",
      transitions: [
        {
          id: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          actors: ["human"]
        }
      ],
      outcome: {
        description: "Ticket resolved",
        valueUnit: "ticket_resolution",
        businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }]
      }
    });

    expect(() =>
      extractLearningSignal(completed, [], definition, { unknown_metric: 12 })
    ).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

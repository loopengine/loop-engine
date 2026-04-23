// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import type { LoopDefinition } from "@loop-engine/core";
import { validateLoopDefinition } from "../validator";

function createValidLoop(): LoopDefinition {
  return {
    id: "support.ticket",
    version: "1.0.0",
    name: "Support Ticket",
    description: "Ticket handling loop",
    states: [
      { id: "OPEN", label: "Open" },
      { id: "IN_REVIEW", label: "In Review" },
      { id: "RESOLVED", label: "Resolved", isTerminal: true }
    ],
    initialState: "OPEN",
    transitions: [
      {
        id: "review",
        from: "OPEN",
        to: "IN_REVIEW",
        signal: "support.ticket.review",
        actors: ["human"],
        guards: [
          {
            id: "confidence-threshold",
            description: "Minimum confidence",
            severity: "soft",
            evaluatedBy: "runtime"
          }
        ]
      },
      {
        id: "resolve",
        from: "IN_REVIEW",
        to: "RESOLVED",
        signal: "support.ticket.resolve",
        actors: ["human"]
      }
    ],
    outcome: {
      description: "Ticket resolved",
      valueUnit: "ticket_resolution",
      businessMetrics: [
        {
          id: "cycle_time_days",
          label: "Cycle time days",
          unit: "days",
          improvableByAI: true
        }
      ]
    }
  } as LoopDefinition;
}

describe("validateLoopDefinition", () => {
  it("valid loop passes all checks", () => {
    const result = validateLoopDefinition(createValidLoop());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('initialState not in states array -> INVALID_INITIAL_STATE', () => {
    const invalid = { ...createValidLoop(), initialState: "MISSING" } as LoopDefinition;
    const result = validateLoopDefinition(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "INVALID_INITIAL_STATE")).toBe(true);
  });

  it('transition.to state not in states array -> INVALID_TRANSITION_STATE', () => {
    const invalid = createValidLoop();
    invalid.transitions[1] = {
      ...invalid.transitions[1],
      to: "MISSING_STATE"
    } as LoopDefinition["transitions"][number];
    const result = validateLoopDefinition(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "INVALID_TRANSITION_STATE")).toBe(true);
  });

  it('no terminal states -> NO_TERMINAL_STATE', () => {
    const invalid = createValidLoop();
    invalid.states = invalid.states.map((state) => ({ ...state, isTerminal: false }));
    const result = validateLoopDefinition(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "NO_TERMINAL_STATE")).toBe(true);
  });

  it('loop with no path to terminal state -> LOOP_NOT_COMPLETABLE', () => {
    const invalid = createValidLoop();
    invalid.transitions = [
      {
        id: "review",
        from: "OPEN",
        to: "IN_REVIEW",
        signal: "support.ticket.review",
        actors: ["human"]
      }
    ] as LoopDefinition["transitions"];
    const result = validateLoopDefinition(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "LOOP_NOT_COMPLETABLE")).toBe(true);
  });

  it('duplicate guard id in transition -> DUPLICATE_GUARD_ID', () => {
    const invalid = createValidLoop();
    invalid.transitions[0] = {
      ...invalid.transitions[0],
      guards: [
        {
          id: "confidence-threshold",
          description: "Minimum confidence",
          severity: "hard",
          evaluatedBy: "runtime"
        },
        {
          id: "confidence-threshold",
          description: "Duplicate",
          severity: "soft",
          evaluatedBy: "runtime"
        }
      ]
    } as LoopDefinition["transitions"][number];
    const result = validateLoopDefinition(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "DUPLICATE_GUARD_ID")).toBe(true);
  });
});

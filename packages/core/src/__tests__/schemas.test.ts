// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  GuardSpecSchema,
  LoopDefinitionSchema,
  TransitionSpecSchema
} from "../schemas";

describe("LoopDefinitionSchema", () => {
  it("accepts valid loop definition", () => {
    const result = LoopDefinitionSchema.safeParse({
      loopId: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Simple support ticket flow",
      states: [
        { stateId: "OPEN", label: "Open" },
        { stateId: "RESOLVED", label: "Resolved", terminal: true }
      ],
      initialState: "OPEN",
      transitions: [
        {
          transitionId: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          allowedActors: ["human"]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing initialState", () => {
    const result = LoopDefinitionSchema.safeParse({
      loopId: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Simple support ticket flow",
      states: [
        { stateId: "OPEN", label: "Open" },
        { stateId: "RESOLVED", label: "Resolved", terminal: true }
      ],
      transitions: [
        {
          transitionId: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          allowedActors: ["human"]
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("TransitionSpec requires allowedActors to be non-empty array", () => {
    const result = TransitionSpecSchema.safeParse({
      transitionId: "resolve",
      from: "OPEN",
      to: "RESOLVED",
      signal: "support.ticket.resolve",
      allowedActors: []
    });

    expect(result.success).toBe(false);
  });

  it("branded ID types are plain strings at runtime", () => {
    const result = LoopDefinitionSchema.parse({
      loopId: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Simple support ticket flow",
      states: [
        { stateId: "OPEN", label: "Open" },
        { stateId: "RESOLVED", label: "Resolved", terminal: true }
      ],
      initialState: "OPEN",
      transitions: [
        {
          transitionId: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          allowedActors: ["human"]
        }
      ]
    });

    expect(typeof result.loopId).toBe("string");
  });

  it('GuardSpec with severity "hard" parses correctly', () => {
    const result = GuardSpecSchema.safeParse({
      guardId: "confidence-threshold",
      description: "Require confidence threshold",
      severity: "hard",
      evaluatedBy: "runtime"
    });

    expect(result.success).toBe(true);
  });

  it('GuardSpec with severity "medium" fails', () => {
    const result = GuardSpecSchema.safeParse({
      guardId: "confidence-threshold",
      description: "Require confidence threshold",
      severity: "medium",
      evaluatedBy: "runtime"
    });

    expect(result.success).toBe(false);
  });
});

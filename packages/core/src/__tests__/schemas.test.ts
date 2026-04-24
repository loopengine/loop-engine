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
      id: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Simple support ticket flow",
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
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing initialState", () => {
    const result = LoopDefinitionSchema.safeParse({
      id: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Simple support ticket flow",
      states: [
        { id: "OPEN", label: "Open" },
        { id: "RESOLVED", label: "Resolved", isTerminal: true }
      ],
      transitions: [
        {
          id: "resolve",
          from: "OPEN",
          to: "RESOLVED",
          signal: "support.ticket.resolve",
          actors: ["human"]
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("TransitionSpec requires actors to be non-empty array", () => {
    const result = TransitionSpecSchema.safeParse({
      id: "resolve",
      from: "OPEN",
      to: "RESOLVED",
      signal: "support.ticket.resolve",
      actors: []
    });

    expect(result.success).toBe(false);
  });

  it("TransitionSpec defaults signal to id when authored signal is absent (PB-EX-05 Option B)", () => {
    const result = TransitionSpecSchema.safeParse({
      id: "resolve",
      from: "OPEN",
      to: "RESOLVED",
      actors: ["human"]
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.signal).toBe("resolve");
    }
  });

  it("branded ID types are plain strings at runtime", () => {
    const result = LoopDefinitionSchema.parse({
      id: "support.ticket",
      version: "1.0.0",
      name: "Support Ticket",
      description: "Simple support ticket flow",
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
      ]
    });

    expect(typeof result.id).toBe("string");
  });

  it('GuardSpec with severity "hard" parses correctly', () => {
    const result = GuardSpecSchema.safeParse({
      id: "confidence-threshold",
      description: "Require confidence threshold",
      severity: "hard",
      evaluatedBy: "runtime"
    });

    expect(result.success).toBe(true);
  });

  it('GuardSpec with severity "medium" fails', () => {
    const result = GuardSpecSchema.safeParse({
      id: "confidence-threshold",
      description: "Require confidence threshold",
      severity: "medium",
      evaluatedBy: "runtime"
    });

    expect(result.success).toBe(false);
  });
});

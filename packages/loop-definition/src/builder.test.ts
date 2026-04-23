// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { LoopBuilder } from "./builder";

describe("LoopBuilder", () => {
  it("builds a valid minimal loop definition", () => {
    const loop = LoopBuilder.create("test.loop", "test")
      .version("1.0.0")
      .description("Minimal test loop")
      .state("OPEN")
      .state("CLOSED", { isTerminal: true })
      .initialState("OPEN")
      .transition({ id: "close", from: "OPEN", to: "CLOSED", actors: ["human"] })
      .build();

    expect(loop.id).toBe("test.loop");
    expect(loop.initialState).toBe("OPEN");
    expect(loop.states).toHaveLength(2);
    expect(loop.transitions).toHaveLength(1);
  });

  it("throws if initialState is not declared", () => {
    expect(() =>
      LoopBuilder.create("bad.loop", "test")
        .version("1.0.0")
        .description("bad")
        .state("OPEN")
        .initialState("MISSING")
        .transition({ id: "noop", from: "OPEN", to: "OPEN", actors: ["human"] })
        .build()
    ).toThrow(/initialState/);
  });

  it("is immutable — chaining does not mutate prior builder", () => {
    const base = LoopBuilder.create("base.loop", "test")
      .version("1.0.0")
      .description("base")
      .state("OPEN");
    const a = base.state("APPROVED", { isTerminal: true });
    const b = base.state("REJECTED", { isTerminal: true });
    const loopA = a
      .initialState("OPEN")
      .transition({ id: "approve", from: "OPEN", to: "APPROVED", actors: ["human"] })
      .build();
    const loopB = b
      .initialState("OPEN")
      .transition({ id: "reject", from: "OPEN", to: "REJECTED", actors: ["human"] })
      .build();
    expect(loopA.states.find((s) => s.id === "REJECTED")).toBeUndefined();
    expect(loopB.states.find((s) => s.id === "APPROVED")).toBeUndefined();
  });

  it("normalizes actor strings to ActorType enum", () => {
    const loop = LoopBuilder.create("actor.test", "test")
      .version("1.0.0")
      .description("actors")
      .state("A")
      .state("B", { isTerminal: true })
      .initialState("A")
      .transition({ id: "go", from: "A", to: "B", actors: ["ai_agent", "human"] })
      .build();
    const t = loop.transitions[0];
    expect(t?.actors).toContain("ai-agent");
    expect(t?.actors).toContain("human");
  });

  it("includes domain as a tag", () => {
    const loop = LoopBuilder.create("tagged.loop", "finance")
      .version("1.0.0")
      .description("tagged")
      .state("A")
      .state("B", { isTerminal: true })
      .initialState("A")
      .transition({ id: "go", from: "A", to: "B", actors: ["human"] })
      .build();
    expect(loop.tags).toContain("finance");
  });

  it("maps shorthand confidence guard into parameters", () => {
    const loop = LoopBuilder.create("guard.shorthand", "test")
      .version("1.0.0")
      .description("g")
      .state("A")
      .state("B", { isTerminal: true })
      .initialState("A")
      .transition({
        id: "step",
        from: "A",
        to: "B",
        actors: ["human"],
        guards: [{ id: "confidence_check", type: "confidence_threshold", minimum: 0.85 }]
      })
      .build();

    const g = loop.transitions[0]?.guards?.[0];
    expect(g?.id).toBe("confidence_check");
    expect(g?.parameters?.type).toBe("confidence_threshold");
    expect(g?.parameters?.minimum).toBe(0.85);
  });
});

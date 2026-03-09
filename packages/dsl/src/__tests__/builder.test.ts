// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { LoopBuilder } from "../builder";

describe("LoopBuilder", () => {
  it("builds a minimal valid loop definition", () => {
    const def = LoopBuilder.create("finance.approval", "finance")
      .description("Approval flow")
      .state("OPEN")
      .state("CLOSED", { isTerminal: true })
      .initialState("OPEN")
      .transition({ id: "close", from: "OPEN", to: "CLOSED", actors: ["human"] })
      .outcome({
        id: "approved",
        description: "Approved",
        valueUnit: "approval_completed",
        measurable: true
      })
      .build();

    expect(def.id).toBe("finance.approval");
  });

  it("build() throws on missing outcome", () => {
    const build = () =>
      LoopBuilder.create("x", "finance")
        .state("OPEN")
        .state("CLOSED", { isTerminal: true })
        .initialState("OPEN")
        .transition({ id: "close", from: "OPEN", to: "CLOSED", actors: ["human"] })
        .build();
    expect(build).toThrow("outcome is required");
  });

  it("build() throws on initialState not in states", () => {
    const build = () =>
      LoopBuilder.create("x", "finance")
        .state("OPEN")
        .state("CLOSED", { isTerminal: true })
        .initialState("MISSING")
        .transition({ id: "close", from: "OPEN", to: "CLOSED", actors: ["human"] })
        .outcome({
          id: "approved",
          description: "Approved",
          valueUnit: "approval_completed",
          measurable: true
        })
        .build();
    expect(build).toThrow("initialState must exist in states");
  });

  it("transition with empty actors throws", () => {
    expect(() =>
      LoopBuilder.create("x", "finance").transition({
        id: "close",
        from: "OPEN",
        to: "CLOSED",
        actors: []
      })
    ).toThrow("must have at least one actor");
  });
});

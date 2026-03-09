// @license MIT
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import type { LoopStatus, TransitionSpec } from "../types";
import { loopId, stateId, transitionId } from "../types";

describe("core types", () => {
  it("loopId() preserves string value", () => {
    expect(loopId("demo.loop")).toBe("demo.loop");
  });

  it("LoopStatus includes all expected values", () => {
    const statuses: LoopStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED", "ERROR", "CANCELLED"];
    expect(statuses).toHaveLength(5);
  });

  it("TransitionSpec with empty allowedActors is structurally valid", () => {
    const spec: TransitionSpec = {
      id: transitionId("x"),
      from: stateId("A"),
      to: stateId("B"),
      allowedActors: []
    };
    expect(spec.allowedActors).toEqual([]);
  });
});

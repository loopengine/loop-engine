// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { loopId, outcomeId, stateId, transitionId, type LoopDefinition } from "@loop-engine/core";
import { createLoopSystem } from "../index";

function demoLoop(): LoopDefinition {
  return {
    id: loopId("demo.loop"),
    version: "1.0.0",
    description: "Demo loop",
    domain: "demo",
    states: [{ id: stateId("OPEN") }, { id: stateId("DONE"), isTerminal: true }],
    initialState: stateId("OPEN"),
    transitions: [
      {
        id: transitionId("finish"),
        from: stateId("OPEN"),
        to: stateId("DONE"),
        allowedActors: ["human"]
      }
    ],
    outcome: {
      id: outcomeId("done"),
      description: "Done",
      valueUnit: "done",
      measurable: true
    }
  };
}

describe("sdk", () => {
  it("createLoopSystem returns engine and eventBus", async () => {
    const system = await createLoopSystem({ loops: [demoLoop()] });
    expect(system.engine).toBeDefined();
    expect(system.eventBus).toBeDefined();
  });
});

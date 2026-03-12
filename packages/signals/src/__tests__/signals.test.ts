// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { createSignalEngine } from "../engine";

describe("signals package", () => {
  it("emits threshold signal when evidence exceeds threshold", () => {
    const engine = createSignalEngine();
    const signals = engine.process([
      {
        type: "loop.transition.executed",
        eventId: "e1",
        loopId: "demo.loop",
        aggregateId: "A-1",
        orgId: "acme",
        occurredAt: new Date().toISOString(),
        correlationId: "corr-1",
        fromState: "OPEN",
        toState: "IN_REVIEW",
        transitionId: "x",
        actor: { type: "system", id: "system:1" },
        evidence: { value: 11 }
      } as any
    ]);
    expect(signals.length).toBeGreaterThan(0);
  });
});

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  actorId,
  aggregateId,
  guardId,
  loopId,
  signalId,
  stateId,
  transitionId
} from "../idFactories";
import type {
  ActorId,
  AggregateId,
  GuardId,
  LoopId,
  SignalId,
  StateId,
  TransitionId
} from "../schemas";

describe("ID factories (D-01)", () => {
  it("loopId returns the string unchanged at runtime", () => {
    expect(loopId("support.ticket")).toBe("support.ticket");
  });

  it("aggregateId returns the string unchanged at runtime", () => {
    expect(aggregateId("acct-123")).toBe("acct-123");
  });

  it("transitionId returns the string unchanged at runtime", () => {
    expect(transitionId("submit")).toBe("submit");
  });

  it("guardId returns the string unchanged at runtime", () => {
    expect(guardId("evidence-required")).toBe("evidence-required");
  });

  it("signalId returns the string unchanged at runtime", () => {
    expect(signalId("approved")).toBe("approved");
  });

  it("stateId returns the string unchanged at runtime", () => {
    expect(stateId("OPEN")).toBe("OPEN");
  });

  it("actorId returns the string unchanged at runtime", () => {
    expect(actorId("user-42")).toBe("user-42");
  });

  it("returns branded types at the type level", () => {
    // These assignments compile only because the factories return the
    // branded types. The underlying string values are arbitrary; the
    // test exists to lock in the type-level contract.
    const lid: LoopId = loopId("loop");
    const aid: AggregateId = aggregateId("agg");
    const tid: TransitionId = transitionId("trans");
    const gid: GuardId = guardId("guard");
    const sigid: SignalId = signalId("sig");
    const sid: StateId = stateId("state");
    const actId: ActorId = actorId("actor");

    expect([lid, aid, tid, gid, sigid, sid, actId]).toHaveLength(7);
  });
});

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import type { GuardSpec } from "@loop-engine/core";
import {
  ConfidenceThresholdGuard,
  EvidenceRequiredGuard,
  evaluateGuards,
  GuardRegistry,
  HumanOnlyGuard
} from "..";
import type { GuardContext } from "../types";

function baseContext(overrides: Partial<GuardContext> = {}): GuardContext {
  return {
    actor: { id: "actor-1", type: "ai-agent" },
    loopId: "support.ticket",
    aggregateId: "ticket-1",
    fromState: "OPEN",
    toState: "RESOLVED",
    signal: "support.ticket.resolve",
    evidence: { confidence: 0.75, ticketId: "t-1" },
    loopData: {},
    ...overrides
  };
}

describe("built-in guards", () => {
  it("confidence-threshold guard passes when confidence >= threshold", async () => {
    const guard = new ConfidenceThresholdGuard();
    const result = await guard.evaluate(baseContext(), { threshold: 0.7 });
    expect(result.passed).toBe(true);
  });

  it("confidence-threshold guard fails when confidence < threshold", async () => {
    const guard = new ConfidenceThresholdGuard();
    const result = await guard.evaluate(baseContext({ evidence: { confidence: 0.5 } }), { threshold: 0.7 });
    expect(result.passed).toBe(false);
  });

  it("human-only guard passes for HumanActor", async () => {
    const guard = new HumanOnlyGuard();
    const result = await guard.evaluate(baseContext({ actor: { id: "user-1", type: "human" } }));
    expect(result.passed).toBe(true);
  });

  it("human-only guard fails for AIAgentActor", async () => {
    const guard = new HumanOnlyGuard();
    const result = await guard.evaluate(baseContext({ actor: { id: "agent-1", type: "ai-agent" } }));
    expect(result.passed).toBe(false);
  });

  it("evidence-required guard fails when field missing", async () => {
    const guard = new EvidenceRequiredGuard();
    const result = await guard.evaluate(baseContext({ evidence: { confidence: 0.9 } }), {
      requiredFields: ["ticketId", "channel"]
    });
    expect(result.passed).toBe(false);
  });
});

describe("evaluateGuards pipeline", () => {
  it("evaluateGuards separates hard vs soft failures correctly", async () => {
    const registry = new GuardRegistry();
    registry.registerBuiltIns();
    const guards: GuardSpec[] = [
      {
        id: "human-only",
        description: "Human required",
        severity: "hard",
        evaluatedBy: "runtime"
      },
      {
        id: "confidence-threshold",
        description: "Confidence warning",
        severity: "soft",
        evaluatedBy: "runtime",
        parameters: { threshold: 0.9 }
      }
    ];

    const summary = await evaluateGuards(guards, baseContext({ evidence: { confidence: 0.8 } }), registry);
    expect(summary.hardFailures).toHaveLength(1);
    expect(summary.softFailures).toHaveLength(1);
  });

  it("evaluateGuards allPassed false when any hard failure present", async () => {
    const registry = new GuardRegistry();
    registry.registerBuiltIns();
    const guards: GuardSpec[] = [
      {
        id: "human-only",
        description: "Human required",
        severity: "hard",
        evaluatedBy: "runtime"
      }
    ];

    const summary = await evaluateGuards(guards, baseContext(), registry);
    expect(summary.allPassed).toBe(false);
  });

  it("evaluateGuards allPassed true when only soft failures (no hard failures)", async () => {
    const registry = new GuardRegistry();
    registry.registerBuiltIns();
    const guards: GuardSpec[] = [
      {
        id: "confidence-threshold",
        description: "Confidence warning",
        severity: "soft",
        evaluatedBy: "runtime",
        parameters: { threshold: 0.95 }
      }
    ];

    const summary = await evaluateGuards(guards, baseContext({ evidence: { confidence: 0.7 } }), registry);
    expect(summary.softFailures).toHaveLength(1);
    expect(summary.hardFailures).toHaveLength(0);
    expect(summary.allPassed).toBe(true);
  });

  it("evaluateGuards throws when guardId not in registry", async () => {
    const registry = new GuardRegistry();
    const guards: GuardSpec[] = [
      {
        id: "missing-guard",
        description: "Missing",
        severity: "hard",
        evaluatedBy: "runtime"
      }
    ];

    await expect(evaluateGuards(guards, baseContext(), registry)).rejects.toThrow(
      "Unknown guard: missing-guard"
    );
  });
});

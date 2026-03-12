// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopEvent } from "@loop-engine/events";
import type { RepeatedGuardFailureConfig, SignalRule } from "../types";

export function repeatedGuardFailureRule(config: RepeatedGuardFailureConfig): SignalRule {
  return {
    id: "repeated-guard-failure",
    name: "Repeated guard failures",
    description: "Detect repeated failure pattern for a guard",
    evaluate(events: LoopEvent[]) {
      const failures = events.filter(
        (e): e is Extract<LoopEvent, { type: "loop.guard.failed" }> =>
          e.type === "loop.guard.failed" && e.guardId === (config.guardId as never)
      );
      if (failures.length < config.maxFailures) return null;
      const last = failures[failures.length - 1];
      if (!last) return null;
      return {
        signalType: "GUARD_FAILURE_PATTERN",
        subject: `${last.loopId}:${last.aggregateId}`,
        confidence: 1,
        payload: { guardId: config.guardId, failures: failures.length }
      };
    }
  };
}

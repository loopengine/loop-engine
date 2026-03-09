// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopEvent } from "@loop-engine/events";
import type { SignalRule, ThresholdRuleConfig } from "../types";

export function thresholdBreachRule(config: ThresholdRuleConfig): SignalRule {
  return {
    id: "threshold-breach",
    name: "Threshold breach",
    description: "Detect when numeric evidence crosses configured threshold",
    evaluate(events: LoopEvent[]) {
      const last = [...events].reverse().find((e) => e.type === "loop.transition.executed") as
        | Extract<LoopEvent, { type: "loop.transition.executed" }>
        | undefined;
      if (!last) return null;
      const value = last.evidence[config.field];
      if (typeof value !== "number") return null;
      const passed =
        config.operator === "lt"
          ? value < config.threshold
          : config.operator === "gt"
            ? value > config.threshold
            : config.operator === "lte"
              ? value <= config.threshold
              : value >= config.threshold;
      if (!passed) return null;
      return {
        signalType: "THRESHOLD_BREACH",
        subject: `${last.loopId}:${last.aggregateId}`,
        confidence: 1,
        payload: { field: config.field, value, threshold: config.threshold }
      };
    }
  };
}

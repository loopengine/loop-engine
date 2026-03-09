// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopEvent } from "@loopengine/events";
import type { SignalRule, StateDwellRuleConfig } from "../types";

export function stateDwellRule(config: StateDwellRuleConfig): SignalRule {
  return {
    id: "state-dwell",
    name: "State dwell",
    description: "Detects loops stuck in a state past threshold",
    evaluate(events: LoopEvent[]) {
      const lastTransition = [...events].reverse().find((e) => e.type === "loop.transition.executed") as
        | Extract<LoopEvent, { type: "loop.transition.executed" }>
        | undefined;
      if (!lastTransition || lastTransition.toState !== config.state) return null;
      const dwellMs = Date.now() - Date.parse(lastTransition.occurredAt);
      if (dwellMs < config.maxDwellMinutes * 60_000) return null;
      return {
        signalType: "STATE_DWELL_EXCEEDED",
        subject: `${lastTransition.loopId}:${lastTransition.aggregateId}`,
        confidence: 1,
        payload: { state: config.state, dwellMs }
      };
    }
  };
}

// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopEvent } from "@loopengine/events";
import type { LoopNotStartedConfig, SignalRule } from "../types";

export function loopNotStartedRule(config: LoopNotStartedConfig): SignalRule {
  return {
    id: "loop-not-started",
    name: "Loop trigger delayed",
    description: "Signal received but no loop start in time window",
    evaluate(events: LoopEvent[]) {
      const signal = [...events].reverse().find((e) => e.type === "loop.signal.received") as
        | Extract<LoopEvent, { type: "loop.signal.received" }>
        | undefined;
      if (!signal) return null;
      const started = events.some(
        (e) => e.type === "loop.started" && e.aggregateId === signal.aggregateId
      );
      if (started) return null;
      const delayMs = Date.now() - Date.parse(signal.occurredAt);
      if (delayMs < config.maxDelayMinutes * 60_000) return null;
      return {
        signalType: "LOOP_TRIGGER_DELAYED",
        subject: `${signal.loopId}:${signal.aggregateId}`,
        confidence: 1,
        payload: { delayMs }
      };
    }
  };
}

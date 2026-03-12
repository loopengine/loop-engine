// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { signalId, type Signal } from "@loop-engine/core";
import type { LoopEvent } from "@loop-engine/events";
import { loopNotStartedRule } from "./built-in/loop-not-started";
import { repeatedGuardFailureRule } from "./built-in/repeated-guard-failure";
import { stateDwellRule } from "./built-in/state-dwell";
import { thresholdBreachRule } from "./built-in/threshold-breach";
import type { SignalEngine, SignalRule } from "./types";

class DefaultSignalEngine implements SignalEngine {
  private rules: SignalRule[] = [];
  private handlers = new Set<(signal: Signal) => void>();

  registerRule(rule: SignalRule): void {
    this.rules.push(rule);
  }

  process(events: LoopEvent[]): Signal[] {
    const now = new Date().toISOString();
    const out: Signal[] = [];
    for (const rule of this.rules) {
      const detected = rule.evaluate(events);
      if (!detected) continue;
      const signal: Signal = {
        id: signalId(`${rule.id}-${Date.now()}`),
        type: detected.signalType,
        subject: detected.subject,
        confidence: detected.confidence,
        observedAt: now,
        payload: detected.payload
      };
      out.push(signal);
      for (const h of this.handlers) h(signal);
    }
    return out;
  }

  subscribe(handler: (signal: Signal) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export function createSignalEngine(): SignalEngine {
  const engine = new DefaultSignalEngine();
  engine.registerRule(thresholdBreachRule({ field: "value", operator: "gt", threshold: 10 }));
  engine.registerRule(stateDwellRule({ state: "OPEN" as never, maxDwellMinutes: 60 }));
  engine.registerRule(repeatedGuardFailureRule({ guardId: "approval_obtained", maxFailures: 3 }));
  engine.registerRule(loopNotStartedRule({ maxDelayMinutes: 15 }));
  return engine;
}

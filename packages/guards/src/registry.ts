// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { GuardEvaluator } from "./types";
import { ConfidenceThresholdGuard } from "./built-in/confidence-threshold";
import { HumanOnlyGuard } from "./built-in/human-only";
import { EvidenceRequiredGuard } from "./built-in/evidence-required";
import { CooldownGuard } from "./built-in/cooldown";

export class GuardRegistry {
  private evaluators = new Map<string, GuardEvaluator>();

  register(guardId: string, evaluator: GuardEvaluator): void {
    this.evaluators.set(guardId, evaluator);
  }

  get(guardId: string): GuardEvaluator | undefined {
    return this.evaluators.get(guardId);
  }

  registerBuiltIns(): void {
    this.register("confidence-threshold", new ConfidenceThresholdGuard());
    this.register("human-only", new HumanOnlyGuard());
    this.register("evidence-required", new EvidenceRequiredGuard());
    this.register("cooldown", new CooldownGuard());
  }
}

export function createGuardRegistry(): GuardRegistry {
  return new GuardRegistry();
}

export const defaultRegistry: GuardRegistry = (() => {
  const registry = new GuardRegistry();
  registry.registerBuiltIns();
  return registry;
})();

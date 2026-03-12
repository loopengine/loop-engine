// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { GuardEvaluator } from "../types";

export class CooldownGuard implements GuardEvaluator {
  async evaluate(
    context: { loopData?: Record<string, unknown> },
    parameters?: Record<string, unknown>
  ) {
    const cooldownMs =
      typeof parameters?.cooldownMs === "number" ? parameters.cooldownMs : 0;
    const rawLastTransitionAt = context.loopData?.lastTransitionAt;
    const lastTransitionAt =
      typeof rawLastTransitionAt === "string"
        ? Date.parse(rawLastTransitionAt)
        : Number(rawLastTransitionAt);

    if (!Number.isFinite(lastTransitionAt)) {
      return {
        passed: true,
        message: "No prior transition timestamp; cooldown not applicable"
      };
    }

    const elapsedMs = Date.now() - lastTransitionAt;
    const passed = elapsedMs > cooldownMs;
    return {
      passed,
      code: passed ? undefined : "cooldown_not_elapsed",
      message: passed
        ? "Cooldown elapsed"
        : "Transition blocked: cooldown period not elapsed",
      metadata: { elapsedMs, cooldownMs }
    };
  }
}

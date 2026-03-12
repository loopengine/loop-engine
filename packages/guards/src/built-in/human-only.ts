// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { GuardEvaluator } from "../types";

export class HumanOnlyGuard implements GuardEvaluator {
  async evaluate(context: { actor: { type: string } }) {
    const passed = context.actor.type === "human";
    return {
      passed,
      code: passed ? undefined : "human_actor_required",
      message: passed
        ? "Human actor requirement satisfied"
        : "This transition requires a human actor"
    };
  }
}

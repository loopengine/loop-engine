// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { GuardEvaluator } from "../types";

export class ConfidenceThresholdGuard implements GuardEvaluator {
  async evaluate(
    context: { evidence?: Record<string, unknown> },
    parameters?: Record<string, unknown>
  ) {
    const threshold =
      typeof parameters?.threshold === "number" ? parameters.threshold : 0.7;
    const actual =
      typeof context.evidence?.confidence === "number"
        ? context.evidence.confidence
        : Number(context.evidence?.confidence ?? 0);
    const passed = actual >= threshold;
    return {
      passed,
      code: passed ? undefined : "confidence_below_threshold",
      message: passed
        ? "Confidence threshold met"
        : `AI confidence ${actual} below required threshold ${threshold}`
    };
  }
}

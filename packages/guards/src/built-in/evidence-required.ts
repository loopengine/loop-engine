// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { GuardEvaluator } from "../types";

export class EvidenceRequiredGuard implements GuardEvaluator {
  async evaluate(
    context: { evidence?: Record<string, unknown> },
    parameters?: Record<string, unknown>
  ) {
    const requiredFields = Array.isArray(parameters?.requiredFields)
      ? parameters.requiredFields.filter((field): field is string => typeof field === "string")
      : [];
    const evidence = context.evidence ?? {};
    const missing = requiredFields.filter((field) => !(field in evidence));
    const passed = missing.length === 0;
    return {
      passed,
      code: passed ? undefined : "missing_evidence_fields",
      message: passed
        ? "Required evidence present"
        : `Missing required evidence fields: ${missing.join(", ")}`
    };
  }
}

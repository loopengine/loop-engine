// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { GuardSpec } from "@loop-engine/core";
import type {
  GuardContext,
  GuardEvaluationResult,
  GuardEvaluationSummary
} from "./types";
import { GuardRegistry } from "./registry";

export async function evaluateGuards(
  guards: GuardSpec[],
  context: GuardContext,
  registry: GuardRegistry
): Promise<GuardEvaluationSummary> {
  const results: GuardEvaluationResult[] = [];

  for (const guard of guards) {
    const evaluator = registry.get(guard.id);
    if (!evaluator) {
      throw new Error(`Unknown guard: ${guard.id}`);
    }

    const evaluated = await evaluator.evaluate(context, guard.parameters);
    results.push({
      guardId: guard.id,
      severity: guard.severity,
      passed: evaluated.passed,
      code: evaluated.code,
      message: evaluated.message ?? "",
      metadata: evaluated.metadata
    });
  }

  const hardFailures = results.filter((result) => !result.passed && result.severity === "hard");
  const softFailures = results.filter((result) => !result.passed && result.severity === "soft");

  return {
    hardFailures,
    softFailures,
    allPassed: hardFailures.length === 0
  };
}

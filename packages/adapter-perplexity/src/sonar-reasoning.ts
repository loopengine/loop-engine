// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * Sonar Reasoning — multi-step analysis models (`sonar-reasoning`, `sonar-reasoning-pro`).
 * Use for Loop steps that need structured inference over retrieved context.
 */

export const SONAR_REASONING_MODELS = ["sonar-reasoning", "sonar-reasoning-pro"] as const;

export type SonarReasoningModel = (typeof SONAR_REASONING_MODELS)[number];

export function isSonarReasoningModel(model: string): model is SonarReasoningModel {
  return (SONAR_REASONING_MODELS as readonly string[]).includes(model);
}

export function defaultReasoningTemperature(): number {
  return 0.3;
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

export interface BuildPricingActorOptions {
  llmProvider: "claude" | "openai";
  apiKey: string;
}

export function buildPricingActor(_options: BuildPricingActorOptions) {
  return async (): Promise<Record<string, unknown>> => {
    throw new Error(
      "[loop-engine/adapter-commerce-gateway] buildPricingActor is not yet implemented. " +
        "Track progress at https://github.com/loopengine/loop-engine/issues"
    );
  };
}

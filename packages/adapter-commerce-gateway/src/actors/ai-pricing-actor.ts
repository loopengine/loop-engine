import type { Evidence } from "@loop-engine/core";

export interface BuildPricingActorOptions {
  llmProvider: "claude" | "openai";
  apiKey: string;
}

export function buildPricingActor(_options: BuildPricingActorOptions) {
  return async (): Promise<Evidence> => {
    throw new Error("buildPricingActor is coming in v0.2");
  };
}

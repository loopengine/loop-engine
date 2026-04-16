// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AdapterInput } from "@loop-engine/core";
import type { PerplexityConfig, PerplexityModel } from "./types";
import { defaultReasoningTemperature, isSonarReasoningModel } from "./sonar-reasoning";

/**
 * Sonar Search — grounded web retrieval (`sonar`, `sonar-pro`, and `sonar-reasoning-pro` when used for search-style prompts).
 */

export const SONAR_SEARCH_MODELS = ["sonar", "sonar-pro", "sonar-reasoning-pro"] as const;

export const DEFAULT_SONAR_MODEL: PerplexityModel = "sonar-pro";

export function defaultSearchTemperature(): number {
  return 0.2;
}

export function resolveTemperature(input: AdapterInput, model: string): number {
  if (input.temperature !== undefined) {
    return input.temperature;
  }
  return isSonarReasoningModel(model) ? defaultReasoningTemperature() : defaultSearchTemperature();
}

export function resolveModel(input: AdapterInput, config: PerplexityConfig): string {
  const fromEnv = process.env.PERPLEXITY_DEFAULT_MODEL;
  return (
    input.model ??
    config.defaultModel ??
    (fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined) ??
    DEFAULT_SONAR_MODEL
  );
}

export function buildMessages(input: AdapterInput): Array<{ role: "system" | "user"; content: string }> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  const system = input.systemPrompt?.trim();
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: input.prompt });
  return messages;
}

export function buildCompletionBody(
  input: AdapterInput,
  config: PerplexityConfig,
  model: string
): Record<string, unknown> {
  const meta = input.metadata ?? {};
  const searchRecency =
    meta.searchRecencyFilter ??
    config.defaultSearchRecency ??
    ("month" as const);

  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(input),
    max_tokens: input.maxTokens ?? 1024,
    temperature: resolveTemperature(input, model),
    search_recency_filter: searchRecency,
    return_citations: meta.returnCitations ?? true,
    return_images: meta.returnImages ?? false
  };

  if (meta.searchDomainFilter && meta.searchDomainFilter.length > 0) {
    body.search_domain_filter = meta.searchDomainFilter;
  }

  return body;
}

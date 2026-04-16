// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AdapterOutput, SearchRecencyFilter } from "@loop-engine/core";

/**
 * Supported Sonar chat models (Perplexity API v1).
 * Model availability changes; treat this as the supported set for this package version.
 */
export type PerplexityModel =
  | "sonar"
  | "sonar-pro"
  | "sonar-reasoning"
  | "sonar-reasoning-pro";

export type SearchRecency = SearchRecencyFilter;

export interface PerplexityConfig {
  /** Defaults to `process.env.PERPLEXITY_API_KEY`. */
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: PerplexityModel;
  defaultSearchRecency?: SearchRecency;
  timeout?: number;
  /** Retry attempts after a failed request (429, 5xx, timeout). Default 3. */
  retries?: number;
}

export interface Citation {
  url: string;
  title: string;
  snippet: string;
}

/** Raw Perplexity / Sonar chat completion shape (OpenAI-compatible + extensions). */
export interface PerplexityApiResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  citations?: Array<string | { url?: string; title?: string }>;
  search_results?: Array<{
    title?: string;
    url?: string;
    date?: string;
  }>;
  [key: string]: unknown;
}

export interface SonarResult extends AdapterOutput {
  citations: Citation[];
  raw: PerplexityApiResponse;
}

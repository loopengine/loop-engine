// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

export { PerplexityAdapter, createPerplexityAdapter } from "./adapter";
export { PerplexityAdapterError, RateLimitError } from "./errors";
export {
  buildCompletionBody,
  buildMessages,
  DEFAULT_SONAR_MODEL,
  defaultSearchTemperature,
  resolveModel,
  resolveTemperature,
  SONAR_SEARCH_MODELS
} from "./sonar";
export {
  defaultReasoningTemperature,
  isSonarReasoningModel,
  SONAR_REASONING_MODELS,
  type SonarReasoningModel
} from "./sonar-reasoning";
export type {
  Citation,
  PerplexityApiResponse,
  PerplexityConfig,
  PerplexityModel,
  SearchRecency,
  SonarResult
} from "./types";

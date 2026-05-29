// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

export type { StudioRunProvider, StudioRunBundle } from "./types.js";
export { StudioClientError, type StudioClientErrorCode, mapHttpStatusToStudioError } from "./errors.js";
export { studioRunApiPaths, resolveStudioRunUrl } from "./paths.js";
export { assertContractPayload, isRunDetailPayload } from "./validate.js";

export { HttpStudioProvider, type HttpStudioProviderOptions } from "./http-studio-provider.js";
export {
  MockStudioProvider,
  createMockStudioProviderFromBundle,
  type MockStudioFixtureSet,
  type MockStudioProviderOptions,
} from "./mock-studio-provider.js";

export { StudioRunClient, createStudioRunClient } from "./studio-run-client.js";

export type {
  RunAuditEventDto,
  RunDetailReadResponse,
  RunEvidenceItemDto,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
  RunReadSummaryDto,
  RunReplaySummaryReadResponse,
  RunTimelineReadResponse,
  TraceLoopTimeline,
  RUNTIME_API_CONTRACT_VERSION,
} from "@loop-engine/observability";

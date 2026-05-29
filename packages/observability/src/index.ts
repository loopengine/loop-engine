// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

/** Trace contract — canonical for hosted PostgresTraceStore and OSS MemoryTraceStore */
export type {
  ComparedStep,
  GuardTraceEntry,
  ListRunsOpts,
  RunComparison,
  RunSummary,
  TraceEventType,
  TraceRecord,
} from "./trace-types.js";
export type { TraceStore } from "./trace-store.js";
export { MemoryTraceStore } from "./memory-trace-store.js";

/** Trace-derived timeline helpers (persisted TraceRecord rows) */
export type {
  TraceLoopMetrics,
  TraceLoopTimeline,
  TraceStateResidency,
} from "./trace-timeline.js";
export {
  buildTimelineFromTrace,
  computeMetricsFromTrace,
  getStateResidencyFromTrace,
  replayLoopFromTrace,
} from "./trace-timeline.js";

/** Instance / TransitionRecord timeline (npm @loop-engine/observability surface) */
export type { LoopTimeline, StateResidency } from "./timeline.js";
export { buildTimeline, getStateResidency } from "./timeline.js";
export type { LoopMetrics } from "./metrics.js";
export { computeMetrics } from "./metrics.js";
export { replayLoop } from "./replay.js";

/** Canonical audit/event read DTOs (RT-05) */
export {
  RUNTIME_API_CONTRACT_VERSION,
  type RunAuditEventDto,
  type RunDetailReadResponse,
  type RunEvidenceItemDto,
  type RunEvidenceReadResponse,
  type RunHistoryReadResponse,
  type RunReadSummaryDto,
  type RunReplaySummaryReadResponse,
  type RunTimelineReadResponse,
} from "./audit-read.js";

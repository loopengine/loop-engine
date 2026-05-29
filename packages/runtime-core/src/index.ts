// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/runtime-core` — hosting-agnostic primitives for the OSS Loop
 * Engine runtime.
 *
 * Pieces:
 *   - Postgres trace store (`OssPostgresTraceStore`) wired through `PrismaTraceRepository`.
 *   - Run-read response builders (`buildRunDetailResponse`, history, evidence, timeline, replay).
 *   - Runtime connections catalog (`listRuntimeConnections`, `buildMetadataConnectionsResponse`).
 *   - DB-backed `AuthAdapter` (`DbAuthAdapter`).
 *   - Canonical error envelope factories (`err401` … `err503`).
 *   - `RuntimeContext` injection shape consumed by `@loop-engine/runtime-routes`.
 */

export type {
  PersistedRunSummaryRow,
  PersistedTraceRow,
  PersistTraceInput,
  TraceReadRepository,
  TraceRepository,
  TraceWriteRepository,
} from "./trace-repository.js";
export { PrismaTraceRepository } from "./trace-repository.js";
export { OssPostgresTraceStore, rowToTraceRecord, isTraceSequenceAllocator } from "./postgres-trace-store.js";
export type { TraceSequenceAllocator } from "./postgres-trace-store.js";

export {
  createLoopDefinitionResolver,
  type LoopDefinitionResolver,
} from "./loop-definition-resolver.js";

export {
  buildRunDetailResponse,
  buildRunEvidenceResponse,
  buildRunHistoryResponse,
  buildRunReplaySummaryResponse,
  buildRunTimelineResponse,
  summaryRowToRunSummary,
  toRunReadSummaryDto,
  traceToAuditEvents,
  traceToEvidenceItems,
  validateTraceSequence,
} from "./build-run-responses.js";

export { DbAuthAdapter } from "./db-auth-adapter.js";

export {
  type ErrorBody,
  err401,
  err403,
  err404,
  err409,
  err422,
  err429,
  err500,
  err503,
} from "./errors.js";

export type { RuntimeContext } from "./runtime-context.js";

export {
  RUNTIME_CONNECTION_CATEGORIES,
  buildMetadataConnectionsResponse,
  getRuntimeConnectionCatalog,
  isRuntimeConnectionCategory,
  listRuntimeConnections,
  parseRuntimeConnectionCategory,
  type AuthType,
  type ImplementationRef,
  type MetadataConnectionsResponse,
  type RuntimeConnection,
  type RuntimeConnectionCatalog,
  type RuntimeConnectionCategory,
  type RuntimeConnectionStatus,
} from "./runtime-connections/index.js";

// RT-20c — OSS write surface primitives.
export type {
  AppendLoopEventInput,
  CreateLoopInstanceInput,
  LoopInstanceRepository,
  PersistedLoopEvent,
  PersistedLoopInstance,
  UpdateLoopInstanceInput,
} from "./loop-instance-repository.js";
export {
  LoopInstanceIdempotencyConflictError,
  LoopInstanceUniqueConflictError,
  PrismaLoopInstanceRepository,
} from "./loop-instance-repository.js";

export {
  __resetOssTraceSequencesForTests,
  createOssTracedLoopSystem,
  type OssTracedLoopSystemConfig,
} from "./oss-traced-loop-system.js";

export {
  executeOssCancel,
  executeOssStart,
  executeOssTransition,
  parseInitialState,
  provisionOssLoopInstance,
  toLoopInstanceDto,
  type CancelLoopInput,
  type CancelLoopOutcome,
  type LoopInstanceDto,
  type ProvisionLoopInstanceInput,
  type ProvisionLoopInstanceOutcome,
  type StartLoopInput,
  type StartLoopOutcome,
  type TransitionActor,
  type TransitionLoopInput,
  type TransitionLoopOutcome,
} from "./loop-execution.js";

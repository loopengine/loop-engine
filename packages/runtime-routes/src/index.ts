// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/runtime-routes` — route handler factories for the RT-01
 * frozen API surface.
 *
 * Consumed by `apps/loop-engine-runtime` (Next.js App Router) — each route
 * file imports the relevant factory, calls it with the app's `RuntimeContext`
 * singleton, and re-exports the result as the HTTP verb handler.
 *
 * Factories returned here speak the Web standard `Request`/`Response` shape so
 * the package itself never has to depend on `next`. Tests in this package
 * exercise the handlers without standing up a Next.js server.
 */

export {
  createRunDetailHandler,
  createRunEvidenceHandler,
  createRunHistoryHandler,
  createRunReplaySummaryHandler,
  createRunTimelineHandler,
  type RunRouteHandler,
} from "./runs.js";

export {
  createMetadataConnectionsHandler,
  type MetadataConnectionsHandler,
} from "./metadata-connections.js";

export {
  __resetRateLimitWindowsForTests,
  withPersistedRunRead,
  type RunReadContext,
  type RunReadHandler,
} from "./with-persisted-run-read.js";

// RT-20c — OSS write surface.
export {
  __resetWriteRateLimitWindowsForTests,
  withPersistedRunWrite,
  type WriteHandler,
  type WriteHandlerContext,
} from "./with-persisted-run-write.js";

export {
  createLoopCancelHandler,
  createLoopCreateHandler,
  createLoopStartHandler,
  createLoopTransitionHandler,
  type LoopCreateRouteHandler,
  type LoopWriteRouteHandler,
  type ResolveLoopDefinitionFn,
  type WriteRuntimeContext,
} from "./loops.js";

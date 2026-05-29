// SPDX-License-Identifier: Apache-2.0
// Copyright © Loop Engine Contributors

import type { ListRunsOpts, RunComparison, RunSummary, TraceRecord } from "./trace-types.js";

/**
 * TraceStore — durable storage contract for Loop Engine transition traces.
 *
 * Every state transition produces a TraceRecord that must be written
 * before the transition is acknowledged as complete. If write() throws,
 * the transition must not proceed.
 *
 * OSS implementations: MemoryTraceStore (this package)
 * Hosted implementations: PostgresTraceStore (@betterdata/database-loops)
 */
export interface TraceStore {
  /**
   * Write a single trace record.
   * Must be durable before returning.
   * Throwing causes the calling transition to abort.
   */
  write(record: TraceRecord): Promise<void>;

  /**
   * Reconstruct all records for a run in sequence order.
   */
  getRunTrace(loopRunId: string): Promise<TraceRecord[]>;

  /**
   * List run summaries for a loop definition, newest first.
   */
  listRuns(loopId: string, opts?: ListRunsOpts): Promise<RunSummary[]>;

  /**
   * Diff two runs step-by-step.
   * Identifies the first sequence number where behavior diverged.
   */
  compareRuns(loopRunIdA: string, loopRunIdB: string): Promise<RunComparison>;
}

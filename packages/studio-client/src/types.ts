// SPDX-License-Identifier: Apache-2.0

import type {
  RunDetailReadResponse,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
  RunReplaySummaryReadResponse,
  RunTimelineReadResponse,
} from "@loop-engine/observability";

/** Canonical Studio data provider — RT-05 read surfaces only. */
export interface StudioRunProvider {
  getRun(runId: string): Promise<RunDetailReadResponse>;
  getRunHistory(runId: string): Promise<RunHistoryReadResponse>;
  getRunEvidence(runId: string): Promise<RunEvidenceReadResponse>;
  getRunTimeline(runId: string): Promise<RunTimelineReadResponse>;
  getReplaySummary(runId: string): Promise<RunReplaySummaryReadResponse>;
}

/** Bundle for RT-06 presentational components */
export interface StudioRunBundle {
  detail: RunDetailReadResponse;
  history: RunHistoryReadResponse;
  evidence: RunEvidenceReadResponse;
  timeline: RunTimelineReadResponse;
  replaySummary: RunReplaySummaryReadResponse;
}

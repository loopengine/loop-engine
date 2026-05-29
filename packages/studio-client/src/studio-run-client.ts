// SPDX-License-Identifier: Apache-2.0

import type {
  RunDetailReadResponse,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
  RunReplaySummaryReadResponse,
  RunTimelineReadResponse,
} from "@loop-engine/observability";
import type { StudioRunBundle, StudioRunProvider } from "./types.js";

/**
 * Typed facade over {@link StudioRunProvider} for RT-06 UI hosts.
 */
export class StudioRunClient {
  constructor(readonly provider: StudioRunProvider) {}

  getRun(runId: string): Promise<RunDetailReadResponse> {
    return this.provider.getRun(runId);
  }

  getRunHistory(runId: string): Promise<RunHistoryReadResponse> {
    return this.provider.getRunHistory(runId);
  }

  getRunEvidence(runId: string): Promise<RunEvidenceReadResponse> {
    return this.provider.getRunEvidence(runId);
  }

  getRunTimeline(runId: string): Promise<RunTimelineReadResponse> {
    return this.provider.getRunTimeline(runId);
  }

  getReplaySummary(runId: string): Promise<RunReplaySummaryReadResponse> {
    return this.provider.getReplaySummary(runId);
  }

  /** Load all RT-05 read surfaces for a run (parallel). */
  async getRunBundle(runId: string): Promise<StudioRunBundle> {
    const [detail, history, evidence, timeline, replaySummary] = await Promise.all([
      this.getRun(runId),
      this.getRunHistory(runId),
      this.getRunEvidence(runId),
      this.getRunTimeline(runId),
      this.getReplaySummary(runId),
    ]);
    return { detail, history, evidence, timeline, replaySummary };
  }
}

export function createStudioRunClient(provider: StudioRunProvider): StudioRunClient {
  return new StudioRunClient(provider);
}

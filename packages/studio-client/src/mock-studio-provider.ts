// SPDX-License-Identifier: Apache-2.0

import type {
  RunDetailReadResponse,
  RunEvidenceReadResponse,
  RunHistoryReadResponse,
  RunReplaySummaryReadResponse,
  RunTimelineReadResponse,
} from "@loop-engine/observability";
import { StudioClientError } from "./errors.js";
import type { StudioRunBundle, StudioRunProvider } from "./types.js";

export type MockStudioFixtureSet = StudioRunBundle;

export type MockStudioProviderOptions = {
  /** Fixture bundle keyed by loopRunId (defaults to RT-06 demo run). */
  runs?: Record<string, MockStudioFixtureSet>;
  /** Simulated latency in ms (for loading-state demos). */
  latencyMs?: number;
};

const DEFAULT_RUN_ID = "run_demo_01";

export class MockStudioProvider implements StudioRunProvider {
  private readonly runs: Record<string, MockStudioFixtureSet>;
  private readonly latencyMs: number;

  constructor(options: MockStudioProviderOptions = {}) {
    this.runs = options.runs ?? {};
    this.latencyMs = options.latencyMs ?? 0;
  }

  /** Register or replace a fixture bundle for a run id. */
  registerRun(runId: string, bundle: MockStudioFixtureSet): void {
    this.runs[runId] = bundle;
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  private resolve(runId: string): MockStudioFixtureSet {
    const bundle = this.runs[runId];
    if (!bundle) {
      throw new StudioClientError("not_found", `Mock run not found: ${runId}`);
    }
    return bundle;
  }

  async getRun(runId: string): Promise<RunDetailReadResponse> {
    await this.delay();
    return this.resolve(runId).detail;
  }

  async getRunHistory(runId: string): Promise<RunHistoryReadResponse> {
    await this.delay();
    return this.resolve(runId).history;
  }

  async getRunEvidence(runId: string): Promise<RunEvidenceReadResponse> {
    await this.delay();
    return this.resolve(runId).evidence;
  }

  async getRunTimeline(runId: string): Promise<RunTimelineReadResponse> {
    await this.delay();
    return this.resolve(runId).timeline;
  }

  async getReplaySummary(runId: string): Promise<RunReplaySummaryReadResponse> {
    await this.delay();
    return this.resolve(runId).replaySummary;
  }
}

/** Register a full RT-05 bundle for a run id (typical source: `@loop-engine/studio-ui` fixtures). */
export function createMockStudioProviderFromBundle(
  bundle: MockStudioFixtureSet,
): MockStudioProvider {
  const runId = bundle.detail.run.loopRunId;
  return new MockStudioProvider({
    runs: { [runId]: bundle, [DEFAULT_RUN_ID]: bundle },
  });
}

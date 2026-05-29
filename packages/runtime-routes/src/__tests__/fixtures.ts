// SPDX-License-Identifier: Apache-2.0

import { MemoryAuthAdapter } from "@loop-engine/auth-iface";
import { MemoryEntitlementsAdapter } from "@loop-engine/entitlements-iface";
import type {
  PersistedTraceRow,
  RuntimeContext,
  TraceReadRepository,
} from "@loop-engine/runtime-core";

export const DEMO_TENANT = "self-host-tenant";
export const DEMO_RUN_ID = "self-host-demo-run-1";
export const DEMO_LOOP_ID = "dual-surface.spreadsheet-approval";
// 32 hex chars — passes `isLoopEngineApiKeyToken`. Mirrors the OSS seed default.
export const DEMO_API_KEY = "le_5e1f0057de51f057de51f057de51f001";

type SummaryRow = ReturnType<typeof buildSummaryRow>;

class InMemoryTraceRepository implements TraceReadRepository {
  constructor(
    private readonly summaries: Map<string, { row: SummaryRow }>,
    private readonly traces: Map<string, PersistedTraceRow[]>,
  ) {}
  async getRunSummary(loopRunId: string, tenantId: string) {
    const key = `${tenantId}:${loopRunId}`;
    return this.summaries.get(key)?.row ?? null;
  }
  async getRunTrace(loopRunId: string, tenantId: string): Promise<PersistedTraceRow[]> {
    const key = `${tenantId}:${loopRunId}`;
    return this.traces.get(key) ?? [];
  }
}

function buildSummaryRow() {
  return {
    tenantId: DEMO_TENANT,
    loopRunId: DEMO_RUN_ID,
    loopId: DEMO_LOOP_ID,
    startedAt: new Date("2026-05-01T11:00:00.000Z"),
    completedAt: new Date("2026-05-01T11:08:00.000Z"),
    terminalState: "APPROVED" as string | null,
    stepCount: 3,
    blockedCount: 0,
    governed: true,
    updatedAt: new Date("2026-05-01T11:08:00.000Z"),
  };
}

function buildPersistedTraceRows(): PersistedTraceRow[] {
  return [
    {
      id: "tr_0",
      loopRunId: DEMO_RUN_ID,
      loopId: DEMO_LOOP_ID,
      tenantId: DEMO_TENANT,
      sequence: 0,
      timestamp: new Date("2026-05-01T11:00:00.000Z"),
      type: "transition.completed",
      fromState: null,
      toState: "OPEN",
      transitionId: "loop.started",
      actorType: "system",
      actorId: "system:seed",
      inputHash: "h0",
      input: {},
      output: {},
      guards: [],
      evidence: {},
      durationMs: 1,
      blocked: false,
      blockReason: null,
      governed: true,
    },
    {
      id: "tr_1",
      loopRunId: DEMO_RUN_ID,
      loopId: DEMO_LOOP_ID,
      tenantId: DEMO_TENANT,
      sequence: 1,
      timestamp: new Date("2026-05-01T11:05:00.000Z"),
      type: "transition.completed",
      fromState: "OPEN",
      toState: "PENDING_APPROVAL",
      transitionId: "sheet.submitted",
      actorType: "human",
      actorId: "user:demo",
      inputHash: "h1",
      input: {},
      output: {},
      guards: [],
      evidence: {
        integration: {
          provider: "google",
          integrationConnectionId: "integration.google_sheets",
          spreadsheetId: "demo",
        },
      },
      durationMs: 5,
      blocked: false,
      blockReason: null,
      governed: true,
    },
  ];
}

export function buildTestContext(opts: { traceReadEnabled?: boolean; runExists?: boolean } = {}): RuntimeContext {
  const summaries = new Map<string, { row: SummaryRow }>();
  const traces = new Map<string, PersistedTraceRow[]>();
  if (opts.runExists !== false) {
    const summaryKey = `${DEMO_TENANT}:${DEMO_RUN_ID}`;
    summaries.set(summaryKey, { row: buildSummaryRow() });
    traces.set(summaryKey, buildPersistedTraceRows());
  }
  return {
    authAdapter: new MemoryAuthAdapter([
      { token: DEMO_API_KEY, tenantId: DEMO_TENANT, apiKeyId: "key-1" },
    ]),
    entitlementsAdapter: new MemoryEntitlementsAdapter({ tier: 1 }),
    traceRepository: new InMemoryTraceRepository(summaries, traces),
    traceReadEnabled: opts.traceReadEnabled ?? true,
  };
}

export function buildAuthedRequest(path = `/api/v1/runs/${DEMO_RUN_ID}/history`): Request {
  return new Request(`http://localhost:3012${path}`, {
    headers: { Authorization: `Bearer ${DEMO_API_KEY}` },
  });
}

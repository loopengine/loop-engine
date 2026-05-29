import { describe, expect, it } from "vitest";

import type { EvidenceRecord } from "@loop-engine/core";
import type { RunSummary, TraceRecord } from "@loop-engine/observability";
import {
  buildRunDetailResponse,
  buildRunEvidenceResponse,
  buildRunHistoryResponse,
  buildRunReplaySummaryResponse,
  buildRunTimelineResponse,
  validateTraceSequence,
} from "../build-run-responses.js";

const RUN_ID = "self-host-demo-run-1";

function summary(): RunSummary {
  return {
    loopRunId: RUN_ID,
    loopId: "dual-surface.spreadsheet-approval",
    tenantId: "default",
    startedAt: new Date("2026-05-01T11:00:00.000Z"),
    completedAt: new Date("2026-05-01T11:08:00.000Z"),
    terminalState: "APPROVED",
    stepCount: 3,
    blockedCount: 0,
    governed: true,
  };
}

function trace(): TraceRecord[] {
  return [
    {
      id: "tr_0",
      loopRunId: RUN_ID,
      loopId: "dual-surface.spreadsheet-approval",
      tenantId: "default",
      sequence: 0,
      timestamp: new Date("2026-05-01T11:00:00.000Z"),
      type: "transition.completed",
      fromState: null,
      toState: "OPEN",
      transitionId: "loop.started",
      actor: { type: "system", id: "system:seed" } as TraceRecord["actor"],
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
      loopRunId: RUN_ID,
      loopId: "dual-surface.spreadsheet-approval",
      tenantId: "default",
      sequence: 1,
      timestamp: new Date("2026-05-01T11:05:00.000Z"),
      type: "transition.completed",
      fromState: "OPEN",
      toState: "PENDING_APPROVAL",
      transitionId: "sheet.submitted",
      actor: { type: "human", id: "user:demo" } as TraceRecord["actor"],
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
      } as unknown as EvidenceRecord,
      durationMs: 5,
      blocked: false,
      blockReason: null,
      governed: true,
    },
  ];
}

describe("buildRunDetailResponse", () => {
  it("includes contractVersion, run summary DTO, and read surfaces", () => {
    const res = buildRunDetailResponse(summary(), trace());
    expect(res.contractVersion).toBe("runtime-api-2026-05");
    expect(res.run.loopRunId).toBe(RUN_ID);
    expect(res.run.terminalState).toBe("APPROVED");
    expect(res.traceStepCount).toBe(2);
    expect(res.readSurfaces.history).toBe(`/api/v1/runs/${RUN_ID}/history`);
    expect(res.readSurfaces.evidence).toBe(`/api/v1/runs/${RUN_ID}/evidence`);
    expect(res.readSurfaces.timeline).toBe(`/api/v1/runs/${RUN_ID}/timeline`);
    expect(res.readSurfaces.replaySummary).toBe(`/api/v1/runs/${RUN_ID}/replay-summary`);
  });
});

describe("buildRunHistoryResponse", () => {
  it("maps trace records to RunAuditEventDto sorted by sequence", () => {
    const res = buildRunHistoryResponse(summary(), trace());
    expect(res.events.map((e) => e.sequence)).toEqual([0, 1]);
    expect(res.events[0]?.eventId).toBe("tr_0");
    expect(res.events[1]?.actor.id).toBe("user:demo");
  });
});

describe("buildRunEvidenceResponse", () => {
  it("preserves the integration.google_sheets evidence shape so the dual-surface tab lights up", () => {
    const res = buildRunEvidenceResponse(summary(), trace());
    expect(res.items[1]?.evidence).toMatchObject({
      integration: { integrationConnectionId: "integration.google_sheets" },
    });
  });
});

describe("buildRunTimelineResponse + buildRunReplaySummaryResponse", () => {
  it("returns timeline and replay metrics derived from the trace", () => {
    const tl = buildRunTimelineResponse(summary(), trace());
    expect(tl.timeline).toBeDefined();

    const replay = buildRunReplaySummaryResponse(summary(), trace());
    expect(replay.transitionCount).toBeGreaterThanOrEqual(0);
    expect(replay.sequenceValid).toBe(true);
    expect(replay.invalidAtSequence).toBeNull();
  });
});

describe("validateTraceSequence", () => {
  it("flags gaps", () => {
    const bad = [...trace()];
    if (bad[1]) bad[1].sequence = 2;
    const v = validateTraceSequence(bad);
    expect(v.sequenceValid).toBe(false);
    expect(v.invalidAtSequence).toBe(2);
  });
});

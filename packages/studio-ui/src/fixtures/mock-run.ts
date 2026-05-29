// SPDX-License-Identifier: Apache-2.0

import {
  RUNTIME_API_CONTRACT_VERSION,
  type RunDetailReadResponse,
  type RunEvidenceReadResponse,
  type RunHistoryReadResponse,
  type RunReplaySummaryReadResponse,
  type RunTimelineReadResponse,
} from "@loop-engine/observability";

const LOOP_RUN_ID = "run_demo_01";
const LOOP_ID = "demo.commerce-discovery";

export const mockRunDetail: RunDetailReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  run: {
    loopRunId: LOOP_RUN_ID,
    loopId: LOOP_ID,
    startedAt: "2026-05-01T10:00:00.000Z",
    completedAt: "2026-05-01T10:04:12.000Z",
    terminalState: "COMPLETED",
    stepCount: 4,
    blockedCount: 1,
    governed: true,
  },
  traceStepCount: 5,
  readSurfaces: {
    history: `/api/v1/runs/${LOOP_RUN_ID}/history`,
    evidence: `/api/v1/runs/${LOOP_RUN_ID}/evidence`,
    timeline: `/api/v1/runs/${LOOP_RUN_ID}/timeline`,
    replaySummary: `/api/v1/runs/${LOOP_RUN_ID}/replay-summary`,
    legacyTrace: `/api/v1/loops/runs/${LOOP_RUN_ID}`,
  },
};

export const mockRunHistory: RunHistoryReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: LOOP_RUN_ID,
  loopId: LOOP_ID,
  events: [
    {
      eventId: "evt-0",
      sequence: 0,
      type: "loop.started",
      fromState: null,
      toState: "IDLE",
      transitionId: null,
      actor: { id: "system:boot", type: "system" },
      evidence: {},
      occurredAt: "2026-05-01T10:00:00.000Z",
      blocked: false,
      blockReason: null,
    },
    {
      eventId: "evt-1",
      sequence: 1,
      type: "transition.completed",
      fromState: "IDLE",
      toState: "DISCOVERING",
      transitionId: "start-discovery",
      actor: { id: "agent:scout", type: "ai-agent" },
      evidence: { query: "trail runners" },
      occurredAt: "2026-05-01T10:01:05.000Z",
      blocked: false,
      blockReason: null,
    },
    {
      eventId: "evt-2",
      sequence: 2,
      type: "transition.blocked",
      fromState: "DISCOVERING",
      toState: "DISCOVERING",
      transitionId: "approve-vendor",
      actor: { id: "user:alex", type: "human" },
      evidence: { reason: "missing_safety_doc" },
      occurredAt: "2026-05-01T10:02:30.000Z",
      blocked: true,
      blockReason: "guard.evidence_required",
    },
    {
      eventId: "evt-3",
      sequence: 3,
      type: "transition.completed",
      fromState: "DISCOVERING",
      toState: "COMPLETED",
      transitionId: "finalize",
      actor: { id: "user:alex", type: "human" },
      evidence: { approved: true },
      occurredAt: "2026-05-01T10:04:12.000Z",
      blocked: false,
      blockReason: null,
    },
  ],
};

export const mockRunEvidence: RunEvidenceReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: LOOP_RUN_ID,
  loopId: LOOP_ID,
  items: mockRunHistory.events.map((e) => ({
    sequence: e.sequence,
    eventId: e.eventId,
    transitionId: e.transitionId,
    type: e.type,
    occurredAt: e.occurredAt,
    evidence: e.evidence,
  })),
};

export const mockRunTimeline: RunTimelineReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: LOOP_RUN_ID,
  timeline: {
    loopId: LOOP_ID,
    instanceId: LOOP_RUN_ID,
    startedAt: "2026-05-01T10:00:00.000Z",
    completedAt: "2026-05-01T10:04:12.000Z",
    transitions: [
      {
        from: "IDLE",
        to: "DISCOVERING",
        transitionId: "start-discovery",
        actor: { id: "agent:scout", type: "ai-agent" },
        timestamp: "2026-05-01T10:01:05.000Z",
        evidence: { query: "trail runners" },
        guardResults: [{ guardId: "policy.region", passed: true }],
      },
      {
        from: "DISCOVERING",
        to: "DISCOVERING",
        transitionId: "approve-vendor",
        actor: { id: "user:alex", type: "human" },
        timestamp: "2026-05-01T10:02:30.000Z",
        evidence: { reason: "missing_safety_doc" },
        guardResults: [{ guardId: "guard.evidence_required", passed: false, reason: "missing doc" }],
      },
      {
        from: "DISCOVERING",
        to: "COMPLETED",
        transitionId: "finalize",
        actor: { id: "user:alex", type: "human" },
        timestamp: "2026-05-01T10:04:12.000Z",
        evidence: { approved: true },
        guardResults: [{ guardId: "guard.human_approval", passed: true }],
      },
    ],
    stateResidency: [
      {
        state: "IDLE",
        enteredAt: "2026-05-01T10:00:00.000Z",
        exitedAt: "2026-05-01T10:01:05.000Z",
        durationMs: 65_000,
      },
      {
        state: "DISCOVERING",
        enteredAt: "2026-05-01T10:01:05.000Z",
        exitedAt: "2026-05-01T10:04:12.000Z",
        durationMs: 187_000,
      },
    ],
  },
};

export const mockRunReplaySummary: RunReplaySummaryReadResponse = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  loopRunId: LOOP_RUN_ID,
  loopId: LOOP_ID,
  metrics: {
    loopId: LOOP_ID,
    instanceId: LOOP_RUN_ID,
    totalDurationMs: 252_000,
    transitionCount: 3,
    guardBlockCount: 1,
    humanApprovalCount: 2,
    terminalState: "COMPLETED",
    outcomeId: null,
  },
  transitionCount: 3,
  guardBlockCount: 1,
  humanApprovalCount: 2,
  terminalState: "COMPLETED",
  sequenceValid: true,
  invalidAtSequence: null,
};

/** Bundle for Storybook-style demos and tests */
export const mockStudioRunBundle = {
  detail: mockRunDetail,
  history: mockRunHistory,
  evidence: mockRunEvidence,
  timeline: mockRunTimeline,
  replaySummary: mockRunReplaySummary,
} as const;

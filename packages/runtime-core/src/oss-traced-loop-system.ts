// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { createHash } from "node:crypto";
import { type EvidenceRecord, guardEvidence } from "@loop-engine/core";
import type { LoopEngine, TransitionParams, TransitionResult } from "@loop-engine/runtime";
import type {
  GuardTraceEntry,
  TraceEventType,
  TraceRecord,
  TraceStore,
} from "@loop-engine/observability";

import { isTraceSequenceAllocator } from "./postgres-trace-store.js";

/**
 * OSS port of `apps/hosted-loops/lib/trace-wrapper.ts`.
 *
 * Wraps a `LoopEngine.transition` invocation with a post-call trace write
 * against the supplied `TraceStore`. Identical to the hosted wrapper modulo:
 *   - imports the type bag from `@loop-engine/observability` instead of
 *     `@betterdata/database-loops` (the two are structurally identical, RT-20-review
 *     finding #5 / area 4).
 *   - no billing emits.
 *   - no Slack/Google connector hooks.
 *
 * ATOMICITY: Trace writes are post-transition (best-effort). The transition
 * state commits inside `@loop-engine/runtime` before this wrapper records its
 * trace row. If the trace write fails we log and continue — the transition
 * already succeeded. True pre-commit atomicity would require a patched
 * `@loop-engine/runtime` with an explicit traceStore hook.
 *
 * SEQUENCE (RT-20d): When the supplied `TraceStore` implements
 * `TraceSequenceAllocator` (e.g. `OssPostgresTraceStore`), sequence numbers
 * are allocated from Postgres via `max(sequence)+1` inside a transaction.
 * `persistTraceWithSummary` retries on `(tenantId, loopRunId, sequence)`
 * unique violations. In-memory stores without an allocator fall back to a
 * module-scoped Map (single-process tests only).
 */

/** Per-aggregate sequence counter for in-memory / test stores. */
const transitionSequenceByRun = new Map<string, number>();

function nextInProcessSequence(loopRunId: string): number {
  const n = transitionSequenceByRun.get(loopRunId) ?? 0;
  transitionSequenceByRun.set(loopRunId, n + 1);
  return n;
}

async function nextTraceSequence(
  traceStore: TraceStore,
  loopRunId: string,
): Promise<number> {
  if (isTraceSequenceAllocator(traceStore)) {
    return traceStore.allocateNextSequence(loopRunId);
  }
  return nextInProcessSequence(loopRunId);
}

/** Test-only escape hatch. */
export function __resetOssTraceSequencesForTests(): void {
  transitionSequenceByRun.clear();
}

function actorForTrace(actor: TransitionParams["actor"]): TraceRecord["actor"] {
  return {
    id: String(actor.id) as TraceRecord["actor"]["id"],
    type: actor.type,
  };
}

function mapGuardFailures(failures: TransitionResult["guardFailures"]): GuardTraceEntry[] {
  if (!failures?.length) return [];
  return failures.map(
    (g): GuardTraceEntry => ({
      guardId: String(g.guardId),
      passed: false,
      reason: g.message,
      evaluatedAt: new Date(),
      durationMs: 0,
    }),
  );
}

function traceTypeAndBlocked(
  result: TransitionResult | undefined,
  error: Error | null,
): { type: TraceEventType; blocked: boolean; blockReason: string | null } {
  if (error) {
    return { type: "transition.blocked", blocked: true, blockReason: error.message };
  }
  if (!result) {
    return { type: "transition.blocked", blocked: true, blockReason: "No result" };
  }
  const ok = result.status === "executed" && result.toState !== undefined;
  if (ok) {
    return { type: "transition.completed", blocked: false, blockReason: null };
  }
  const reason =
    typeof result.rejectionReason === "string"
      ? result.rejectionReason
      : result.status === "guard_failed"
        ? "Transition blocked by guard"
        : "Transition rejected";
  return { type: "transition.blocked", blocked: true, blockReason: reason };
}

export type OssTracedLoopSystemConfig = {
  loopId: string;
  tenantId: string;
  governed?: boolean;
};

export function createOssTracedLoopSystem(
  loopEngine: LoopEngine,
  traceStore: TraceStore,
  config: OssTracedLoopSystemConfig,
): LoopEngine {
  const originalTransition = loopEngine.transition.bind(loopEngine);

  const wrappedTransition = async (params: TransitionParams): Promise<TransitionResult> => {
    const startMs = Date.now();
    let result: TransitionResult | undefined;
    let transitionError: Error | null = null;

    try {
      result = await originalTransition(params);
    } catch (err) {
      transitionError = err instanceof Error ? err : new Error(String(err));
      throw transitionError;
    } finally {
      const loopRunId = String(params.aggregateId);
      const { type, blocked, blockReason } = traceTypeAndBlocked(result, transitionError);

      const rawInput = params.evidence ?? {};
      const safeInput = guardEvidence(rawInput);
      const safeOutput = guardEvidence(result ?? {});
      const guardEntries = mapGuardFailures(result?.guardFailures);

      let inputHash: string;
      try {
        inputHash = createHash("sha256").update(JSON.stringify(rawInput)).digest("hex");
      } catch {
        inputHash = createHash("sha256").update("[unserializable]").digest("hex");
      }

      const evidencePayload = guardEvidence({
        transitionStatus: result?.status,
        fromState: result?.fromState,
        toState: result?.toState,
        rejectionReason: result?.rejectionReason,
        guardFailures: result?.guardFailures,
      }) as EvidenceRecord;

      let sequence: number;
      try {
        sequence = await nextTraceSequence(traceStore, loopRunId);
      } catch (seqErr) {
        console.error(`[oss-trace] Sequence allocation failed for run ${loopRunId}:`, seqErr);
        sequence = nextInProcessSequence(loopRunId);
      }

      const record: TraceRecord = {
        id: `tr_${loopRunId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        loopRunId,
        loopId: config.loopId,
        sequence,
        timestamp: new Date(),
        type,
        fromState: result?.fromState ?? null,
        toState: result?.toState ?? null,
        transitionId: String(params.transitionId),
        actor: actorForTrace(params.actor),
        inputHash,
        input: safeInput,
        output: safeOutput,
        guards: guardEntries,
        evidence: evidencePayload,
        durationMs: Date.now() - startMs,
        blocked,
        blockReason,
        governed: config.governed ?? false,
        tenantId: config.tenantId,
      };

      void traceStore.write(record).catch((writeErr: unknown) => {
        console.error(`[oss-trace] Post-transition write failed for run ${loopRunId}:`, writeErr);
      });
    }

    return result as TransitionResult;
  };

  return new Proxy(loopEngine, {
    get(target, prop, receiver) {
      if (prop === "transition") return wrappedTransition;
      return Reflect.get(target, prop, receiver);
    },
  }) as LoopEngine;
}

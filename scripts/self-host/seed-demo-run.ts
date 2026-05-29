/**
 * RT-20b — Self-host demo seeder for the OSS Loop Engine runtime.
 *
 * Boots a known LoopEngineApiKey + a LoopRunSummary + the matching
 * LoopTraceRecord rows the RT-01 read surface (`/api/v1/runs/{id}/*`)
 * expects so Studio's HTTP mode (`STUDIO_PROVIDER=http`) shows the
 * dual-surface demo run immediately after `docker compose up`.
 *
 * Idempotent: re-runs reuse the same API key + run id.
 *
 * Run inside the compose stack:
 *   docker compose -f deploy/compose/docker-compose.yml exec loop-engine-runtime \
 *     pnpm exec tsx scripts/self-host/seed-demo-run.ts
 *
 * Hard rules (RT-20b):
 *   - Talks to `@loop-engine/runtime-db` only — no `@betterdata/database-loops`,
 *     no `@repo/database` imports.
 *   - Seeds `LoopTraceRecord` rows so the RT-05 evidence route surfaces the
 *     dual-surface `integration.google_sheets` + `channel.slack` payloads.
 *   - LoopEvent rows are kept for back-compat with the legacy
 *     `/api/v1/loops/{key}/events` consumers (not part of RT-20b's read path).
 */
import { createHash } from "node:crypto";
import { type Prisma, PrismaClient } from "@loop-engine/runtime-db";

const SELF_HOST_TENANT_ID = process.env.LOOP_ENGINE_DEFAULT_TENANT_ID ?? "self-host-tenant";
const DEMO_API_KEY_PLAIN = process.env.LOOP_ENGINE_API_KEY ?? "le_5e1f0057de51f057de51f057de51f001";
const DEMO_LOOP_ID = "dual-surface.spreadsheet-approval";
const DEMO_AGGREGATE_ID = "self-host-demo-run-1";
const DEMO_LOOP_RUN_ID = DEMO_AGGREGATE_ID;

const STARTED_AT = new Date("2026-05-01T11:00:00.000Z");
const SHEET_SUBMITTED_AT = new Date("2026-05-01T11:05:00.000Z");
const SLACK_APPROVED_AT = new Date("2026-05-01T11:08:00.000Z");

const db = new PrismaClient();

function hashLoopApiKey(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

async function ensureApiKey(): Promise<void> {
  const keyHash = hashLoopApiKey(DEMO_API_KEY_PLAIN);
  const existing = await db.loopEngineApiKey.findUnique({ where: { keyHash } });
  if (existing) {
    console.log(`[seed] API key already present (${existing.keyPrefix})`);
    return;
  }
  await db.loopEngineApiKey.create({
    data: {
      tenantId: SELF_HOST_TENANT_ID,
      name: "self-host-demo",
      keyHash,
      keyPrefix: `${DEMO_API_KEY_PLAIN.slice(0, 12)}...`,
      status: "ACTIVE",
    },
  });
  console.log(`[seed] Created demo API key: ${DEMO_API_KEY_PLAIN}`);
}

async function ensureLoopInstance(): Promise<void> {
  const existing = await db.loopInstance.findUnique({
    where: { aggregateId: DEMO_AGGREGATE_ID },
  });
  if (existing) {
    console.log(`[seed] LoopInstance already present (${existing.aggregateId})`);
    return;
  }
  await db.loopInstance.create({
    data: {
      aggregateId: DEMO_AGGREGATE_ID,
      loopId: DEMO_LOOP_ID,
      tenantId: SELF_HOST_TENANT_ID,
      currentState: "CLOSED",
      status: "COMPLETED",
      context: { seededBy: "scripts/self-host/seed-demo-run.ts" },
    },
  });
  console.log(`[seed] Created LoopInstance ${DEMO_AGGREGATE_ID}`);
}

async function ensureLoopEvents(): Promise<void> {
  const existing = await db.loopEvent.findFirst({
    where: { aggregateId: DEMO_AGGREGATE_ID },
  });
  if (existing) {
    console.log("[seed] LoopEvent rows already present");
    return;
  }
  await db.loopEvent.createMany({
    data: [
      {
        aggregateId: DEMO_AGGREGATE_ID,
        tenantId: SELF_HOST_TENANT_ID,
        type: "loop.started",
        fromState: "",
        toState: "OPEN",
        actorId: "system:seed",
        actorType: "system",
        evidence: {},
        occurredAt: STARTED_AT,
      },
    ],
  });
  console.log("[seed] Created 1 demo LoopEvent (legacy events surface)");
}

const SHEETS_EVIDENCE = {
  integration: {
    provider: "google",
    integrationConnectionId: "integration.google_sheets",
    integrationKind: "google_sheets",
    spreadsheetId: "demo-spreadsheet",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/demo-spreadsheet/edit",
    stagedEditId: "demo-stage-1",
    sheetName: "Budget",
    rangeA1: "'Budget'!D3",
    proposedValue: "1200",
    priorValue: "900",
    applyStatus: "pending",
    decisionSignalId: "dual_surface.sheets.submitted_for_approval.v1",
  },
} as const;

const SLACK_EVIDENCE = {
  note: "LGTM",
  channel: {
    channelConnectionId: "channel.slack",
    channelKind: "slack",
    slackTeamId: "TDEMO",
    slackChannelId: "CDEMO",
    slackMessageTs: "1700000000.000100",
    slackUserId: "UDEMO",
    decisionSignalId: "dual_surface.slack.interactive.approve.v1",
  },
} as const;

type TraceSeed = {
  id: string;
  sequence: number;
  timestamp: Date;
  type: string;
  fromState: string | null;
  toState: string | null;
  transitionId: string | null;
  actorType: string;
  actorId: string;
  evidence: Record<string, unknown>;
};

const TRACE_SEEDS: TraceSeed[] = [
  {
    id: "tr_self-host-demo-run-1_0",
    sequence: 0,
    timestamp: STARTED_AT,
    type: "transition.completed",
    fromState: null,
    toState: "OPEN",
    transitionId: "loop.started",
    actorType: "system",
    actorId: "system:seed",
    evidence: { seededBy: "scripts/self-host/seed-demo-run.ts" },
  },
  {
    id: "tr_self-host-demo-run-1_1",
    sequence: 1,
    timestamp: SHEET_SUBMITTED_AT,
    type: "transition.completed",
    fromState: "OPEN",
    toState: "PENDING_APPROVAL",
    transitionId: "dual_surface.sheets.submitted_for_approval",
    actorType: "human",
    actorId: "user:demo",
    evidence: SHEETS_EVIDENCE as unknown as Record<string, unknown>,
  },
  {
    id: "tr_self-host-demo-run-1_2",
    sequence: 2,
    timestamp: SLACK_APPROVED_AT,
    type: "transition.completed",
    fromState: "PENDING_APPROVAL",
    toState: "APPROVED",
    transitionId: "dual_surface.slack.interactive.approve",
    actorType: "human",
    actorId: "user:demo-approver",
    evidence: SLACK_EVIDENCE as unknown as Record<string, unknown>,
  },
];

async function ensureLoopTraceRecords(): Promise<void> {
  const existing = await db.loopTraceRecord.findFirst({
    where: { tenantId: SELF_HOST_TENANT_ID, loopRunId: DEMO_LOOP_RUN_ID },
  });
  if (existing) {
    console.log("[seed] LoopTraceRecord rows already present");
    return;
  }
  for (const t of TRACE_SEEDS) {
    await db.loopTraceRecord.create({
      data: {
        id: t.id,
        loopRunId: DEMO_LOOP_RUN_ID,
        loopId: DEMO_LOOP_ID,
        tenantId: SELF_HOST_TENANT_ID,
        sequence: t.sequence,
        timestamp: t.timestamp,
        type: t.type,
        fromState: t.fromState,
        toState: t.toState,
        transitionId: t.transitionId,
        actorType: t.actorType,
        actorId: t.actorId,
        inputHash: createHash("sha256").update(JSON.stringify({ seed: t.id })).digest("hex"),
        input: {} as Prisma.InputJsonValue,
        output: {} as Prisma.InputJsonValue,
        guards: [] as unknown as Prisma.InputJsonValue,
        evidence: t.evidence as unknown as Prisma.InputJsonValue,
        durationMs: 1,
        blocked: false,
        blockReason: null,
        governed: true,
      },
    });
  }
  console.log(`[seed] Created ${TRACE_SEEDS.length} LoopTraceRecord rows`);
}

async function ensureLoopRunSummary(): Promise<void> {
  await db.loopRunSummary.upsert({
    where: {
      tenantId_loopRunId: { tenantId: SELF_HOST_TENANT_ID, loopRunId: DEMO_LOOP_RUN_ID },
    },
    create: {
      tenantId: SELF_HOST_TENANT_ID,
      loopRunId: DEMO_LOOP_RUN_ID,
      loopId: DEMO_LOOP_ID,
      startedAt: STARTED_AT,
      completedAt: SLACK_APPROVED_AT,
      terminalState: "APPROVED",
      stepCount: TRACE_SEEDS.length,
      blockedCount: 0,
      governed: true,
    },
    update: {
      completedAt: SLACK_APPROVED_AT,
      terminalState: "APPROVED",
      stepCount: TRACE_SEEDS.length,
    },
  });
  console.log(`[seed] Upserted LoopRunSummary ${DEMO_LOOP_RUN_ID}`);
}

async function main(): Promise<void> {
  console.log("[seed] RT-20b OSS Loop Engine runtime self-host seeding…");
  await ensureApiKey();
  await ensureLoopInstance();
  await ensureLoopEvents();
  await ensureLoopTraceRecords();
  await ensureLoopRunSummary();
  console.log("");
  console.log("[seed] Done. Studio HTTP-mode env:");
  console.log("  STUDIO_PROVIDER=http");
  console.log("  LOOP_ENGINE_URL=http://loop-engine-runtime:3012");
  console.log(`  LOOP_ENGINE_API_KEY=${DEMO_API_KEY_PLAIN}`);
  console.log("");
  console.log(`  Run id (open in Studio): ${DEMO_LOOP_RUN_ID}`);
  await db.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[seed] failed", err);
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});

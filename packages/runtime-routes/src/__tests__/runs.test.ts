import { afterEach, describe, expect, it } from "vitest";

async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

import {
  __resetRateLimitWindowsForTests,
  createRunDetailHandler,
  createRunEvidenceHandler,
  createRunHistoryHandler,
  createRunReplaySummaryHandler,
  createRunTimelineHandler,
} from "../index.js";
import { DEMO_RUN_ID, buildAuthedRequest, buildTestContext } from "./fixtures.js";

function paramsOf(id: string) {
  return { params: Promise.resolve({ id }) };
}

afterEach(() => {
  __resetRateLimitWindowsForTests();
});

describe("createRunHistoryHandler", () => {
  it("returns 200 with the RT-05 history envelope when authenticated", async () => {
    const ctx = buildTestContext();
    const handler = createRunHistoryHandler(ctx);
    const res = await handler(buildAuthedRequest(`/api/v1/runs/${DEMO_RUN_ID}/history`), paramsOf(DEMO_RUN_ID));
    expect(res.status).toBe(200);
    const body = await readJson<{ contractVersion: string; loopRunId: string; events: unknown[] }>(res);
    expect(body).toMatchObject({
      contractVersion: "runtime-api-2026-05",
      loopRunId: DEMO_RUN_ID,
    });
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const ctx = buildTestContext();
    const handler = createRunHistoryHandler(ctx);
    const req = new Request(`http://localhost:3012/api/v1/runs/${DEMO_RUN_ID}/history`);
    const res = await handler(req, paramsOf(DEMO_RUN_ID));
    expect(res.status).toBe(401);
  });

  it("returns 503 when trace reads are disabled (LOOP_TRACE_ENABLED=false equivalent)", async () => {
    const ctx = buildTestContext({ traceReadEnabled: false });
    const handler = createRunHistoryHandler(ctx);
    const res = await handler(buildAuthedRequest(), paramsOf(DEMO_RUN_ID));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 404 when the run row is missing for the tenant", async () => {
    const ctx = buildTestContext({ runExists: false });
    const handler = createRunHistoryHandler(ctx);
    const res = await handler(buildAuthedRequest(), paramsOf(DEMO_RUN_ID));
    expect(res.status).toBe(404);
  });
});

describe("createRunEvidenceHandler", () => {
  it("returns evidence items that preserve dual-surface integration fields", async () => {
    const ctx = buildTestContext();
    const handler = createRunEvidenceHandler(ctx);
    const res = await handler(
      buildAuthedRequest(`/api/v1/runs/${DEMO_RUN_ID}/evidence`),
      paramsOf(DEMO_RUN_ID),
    );
    const body = await readJson<{ items: Array<{ evidence: Record<string, unknown> }> }>(res);
    expect(body.items[1]?.evidence).toMatchObject({
      integration: { integrationConnectionId: "integration.google_sheets" },
    });
  });
});

describe("createRunDetailHandler + timeline + replay-summary", () => {
  it("returns the run detail envelope with read surface links", async () => {
    const handler = createRunDetailHandler(buildTestContext());
    const res = await handler(buildAuthedRequest(`/api/v1/runs/${DEMO_RUN_ID}`), paramsOf(DEMO_RUN_ID));
    const body = await readJson<{ readSurfaces: Record<string, string> }>(res);
    expect(body.readSurfaces).toMatchObject({
      history: `/api/v1/runs/${DEMO_RUN_ID}/history`,
      evidence: `/api/v1/runs/${DEMO_RUN_ID}/evidence`,
    });
  });

  it("returns timeline + replay-summary envelopes", async () => {
    const ctx = buildTestContext();
    const tl = await createRunTimelineHandler(ctx)(
      buildAuthedRequest(`/api/v1/runs/${DEMO_RUN_ID}/timeline`),
      paramsOf(DEMO_RUN_ID),
    );
    expect(tl.status).toBe(200);
    const rs = await createRunReplaySummaryHandler(ctx)(
      buildAuthedRequest(`/api/v1/runs/${DEMO_RUN_ID}/replay-summary`),
      paramsOf(DEMO_RUN_ID),
    );
    expect(rs.status).toBe(200);
    expect((await readJson<{ sequenceValid: boolean }>(rs)).sequenceValid).toBe(true);
  });
});

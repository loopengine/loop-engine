// SPDX-License-Identifier: Apache-2.0
import { RUNTIME_API_CONTRACT_VERSION } from "@loop-engine/observability";
import { describe, expect, it, vi } from "vitest";
import { StudioClientError } from "../errors.js";
import { HttpStudioProvider } from "../http-studio-provider.js";
import { studioRunApiPaths } from "../paths.js";

const detailBody = {
  contractVersion: RUNTIME_API_CONTRACT_VERSION,
  run: {
    loopRunId: "run-1",
    loopId: "demo.loop",
    startedAt: "2026-05-01T00:00:00.000Z",
    completedAt: null,
    terminalState: null,
    stepCount: 1,
    blockedCount: 0,
    governed: true,
  },
  traceStepCount: 1,
  readSurfaces: {
    history: "/api/v1/runs/run-1/history",
    evidence: "/api/v1/runs/run-1/evidence",
    timeline: "/api/v1/runs/run-1/timeline",
    replaySummary: "/api/v1/runs/run-1/replay-summary",
    legacyTrace: "/api/v1/loops/runs/run-1",
  },
};

describe("HttpStudioProvider", () => {
  it("GETs canonical run path with caller-supplied headers", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://loops.example/api/v1/runs/run-1");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test" });
      return new Response(JSON.stringify(detailBody), { status: 200 });
    });

    const provider = new HttpStudioProvider({
      baseUrl: "https://loops.example",
      headers: { Authorization: "Bearer test" },
      fetchImpl: fetchImpl as typeof fetch,
    });

    const detail = await provider.getRun("run-1");
    expect(detail.run.loopRunId).toBe("run-1");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(studioRunApiPaths.run("run-1")),
      expect.anything(),
    );
  });

  it("maps 503 to trace_disabled", async () => {
    const provider = new HttpStudioProvider({
      baseUrl: "https://loops.example",
      fetchImpl: vi.fn(async () =>
        new Response(JSON.stringify({ error: "Trace API disabled" }), { status: 503 }),
      ) as typeof fetch,
    });

    await expect(provider.getRun("run-1")).rejects.toMatchObject({ code: "trace_disabled" });
  });
});

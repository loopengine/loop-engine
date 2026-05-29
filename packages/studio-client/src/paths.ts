// SPDX-License-Identifier: Apache-2.0

/** RT-05 canonical run-scoped audit read paths (hosted-loops). */
export const studioRunApiPaths = {
  run: (runId: string) => `/api/v1/runs/${encodeURIComponent(runId)}`,
  history: (runId: string) => `/api/v1/runs/${encodeURIComponent(runId)}/history`,
  evidence: (runId: string) => `/api/v1/runs/${encodeURIComponent(runId)}/evidence`,
  timeline: (runId: string) => `/api/v1/runs/${encodeURIComponent(runId)}/timeline`,
  replaySummary: (runId: string) => `/api/v1/runs/${encodeURIComponent(runId)}/replay-summary`,
} as const;

export function resolveStudioRunUrl(baseUrl: string, path: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

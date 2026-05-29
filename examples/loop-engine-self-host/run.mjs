#!/usr/bin/env node
/**
 * RT-23 — Runnable Loop Engine OSS example (HTTP only).
 *
 * Exercises registry catalog + runtime write/read APIs against a self-host stack.
 * No imports from bd-forge-main internals — only fetch + env vars.
 *
 * Prerequisites:
 *   make self-host-up   (or docker compose from deploy/compose)
 *   make self-host-seed (optional — for Studio dual-surface demo run)
 *
 * Usage:
 *   node run.mjs
 *   LOOP_ENGINE_URL=http://localhost:3012 node run.mjs
 */

const REGISTRY_URL = (process.env.REGISTRY_URL ?? "http://localhost:3011").replace(/\/$/, "");
const RUNTIME_URL = (process.env.LOOP_ENGINE_URL ?? "http://localhost:3012").replace(/\/$/, "");
const STUDIO_URL = (process.env.STUDIO_URL ?? "http://localhost:3020").replace(/\/$/, "");
const API_KEY = process.env.LOOP_ENGINE_API_KEY ?? "le_5e1f0057de51f057de51f057de51f001";
const LOOP_ID = process.env.LOOP_ID ?? "scm.replenishment";

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: "application/json",
};

function log(step, message) {
  console.log(`[example] ${step}: ${message}`);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === "object" ? JSON.stringify(body) : String(body);
    throw new Error(`${init?.method ?? "GET"} ${url} → ${res.status}: ${detail}`);
  }
  return body;
}

async function main() {
  log("1/8", `registry health (${REGISTRY_URL})`);
  await fetchJson(`${REGISTRY_URL}/v0/health`);

  log("2/8", "registry catalog contains scm.replenishment");
  const catalog = await fetchJson(`${REGISTRY_URL}/v0/loops`);
  const ids = (catalog.results ?? []).map((r) => r.id);
  if (!ids.includes(LOOP_ID)) {
    throw new Error(`Expected ${LOOP_ID} in registry catalog; got: ${ids.join(", ") || "(empty)"}`);
  }

  log("3/8", "runtime metadata connections");
  await fetchJson(`${RUNTIME_URL}/api/v1/metadata/connections`);

  const idempotencyKey = `rt23-example-${Date.now()}`;

  log("4/8", `create loop ${LOOP_ID}`);
  const created = await fetchJson(`${RUNTIME_URL}/api/v1/loops`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      loopId: LOOP_ID,
      payload: { sku: "RT23-DEMO-SKU" },
      idempotencyKey,
    }),
  });

  const aggregateId = created.aggregateId ?? created.id;
  if (!aggregateId) {
    throw new Error(`Create response missing aggregateId: ${JSON.stringify(created)}`);
  }
  log("4/8", `created aggregateId=${aggregateId}`);

  log("5/8", "start loop");
  await fetchJson(`${RUNTIME_URL}/api/v1/loops/${encodeURIComponent(aggregateId)}/start`, {
    method: "POST",
    headers: authHeaders,
  });

  log("6/8", "transition (signal: scm.replenishment.close.v1)");
  try {
    await fetchJson(`${RUNTIME_URL}/api/v1/loops/${encodeURIComponent(aggregateId)}/transition`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        signalId: `${LOOP_ID}.close.v1`,
        actor: { id: "user:rt23-example", type: "human" },
      }),
    });
  } catch (err) {
    log("6/8", `transition skipped (${err instanceof Error ? err.message : err})`);
  }

  log("7/8", "read history + evidence");
  const history = await fetchJson(
    `${RUNTIME_URL}/api/v1/runs/${encodeURIComponent(aggregateId)}/history`,
    { headers: authHeaders },
  );
  const evidence = await fetchJson(
    `${RUNTIME_URL}/api/v1/runs/${encodeURIComponent(aggregateId)}/evidence`,
    { headers: authHeaders },
  );
  const eventCount = history?.events?.length ?? 0;
  const evidenceCount = evidence?.items?.length ?? evidence?.evidence?.length ?? 0;
  log("7/8", `history events=${eventCount}, evidence items=${evidenceCount}`);

  log("8/8", "cancel loop");
  try {
    await fetchJson(`${RUNTIME_URL}/api/v1/loops/${encodeURIComponent(aggregateId)}/cancel`, {
      method: "POST",
      headers: authHeaders,
    });
  } catch (err) {
    log("8/8", `cancel skipped (${err instanceof Error ? err.message : err})`);
  }

  log("done", "Studio URLs");
  console.log(`  home:          ${STUDIO_URL}/`);
  console.log(`  run:           ${STUDIO_URL}/runs/${aggregateId}`);
  console.log(`  dual-surface:  ${STUDIO_URL}/runs/self-host-demo-run-1/dual-surface (after seed)`);
  console.log("");
  console.log("[example] OK — Loop Engine OSS runtime consumed via HTTP only.");
}

main().catch((err) => {
  console.error("[example] FAIL:", err instanceof Error ? err.message : err);
  console.error("");
  console.error("Ensure the self-host stack is running:");
  console.error("  make self-host-up");
  console.error("  # wait for services, then re-run: node run.mjs");
  process.exit(1);
});

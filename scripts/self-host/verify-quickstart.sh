#!/usr/bin/env bash
# RT-20b — Verify self-host compose quickstart end-to-end against the
# OSS Loop Engine runtime (apps/loop-engine-runtime).
#
# Usage:
#   bash scripts/self-host/verify-quickstart.sh
#
# Pings each compose service on its published host port and reports OK / FAIL.
# Run after `docker compose up` and the seed script.

set -u
set -o pipefail

REGISTRY_PORT="${SELF_HOST_REGISTRY_PORT:-3011}"
# Back-compat: honor SELF_HOST_HOSTED_LOOPS_PORT if set, otherwise use the new
# SELF_HOST_RUNTIME_PORT (defaults still 3012).
RUNTIME_PORT="${SELF_HOST_RUNTIME_PORT:-${SELF_HOST_HOSTED_LOOPS_PORT:-3012}}"
STUDIO_PORT="${SELF_HOST_STUDIO_PORT:-3020}"
API_KEY="${LOOP_ENGINE_API_KEY:-le_5e1f0057de51f057de51f057de51f001}"
DEMO_RUN_ID="self-host-demo-run-1"

PASS_COUNT=0
FAIL_COUNT=0

step() {
  printf "\n[verify] %s\n" "$1"
}

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    printf "  ok   %s\n" "$label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    printf "  FAIL %s\n" "$label"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

step "registry-loop (:${REGISTRY_PORT})"
check "GET /v0/health" \
  "curl -fsS http://localhost:${REGISTRY_PORT}/v0/health"
check "GET /v0/loops (auto-seeded catalog)" \
  "curl -fsS http://localhost:${REGISTRY_PORT}/v0/loops | grep -q 'scm.replenishment'"

step "loop-engine-runtime read surface (:${RUNTIME_PORT})"
check "GET /api/v1/metadata/connections" \
  "curl -fsS http://localhost:${RUNTIME_PORT}/api/v1/metadata/connections | grep -q channel.slack"
check "GET /api/v1/runs/${DEMO_RUN_ID}/history (Bearer API key)" \
  "curl -fsS -H 'Authorization: Bearer ${API_KEY}' http://localhost:${RUNTIME_PORT}/api/v1/runs/${DEMO_RUN_ID}/history | grep -q events"
check "GET /api/v1/runs/${DEMO_RUN_ID}/evidence (Bearer API key) — dual-surface integration evidence" \
  "curl -fsS -H 'Authorization: Bearer ${API_KEY}' http://localhost:${RUNTIME_PORT}/api/v1/runs/${DEMO_RUN_ID}/evidence | grep -q integration.google_sheets"
check "GET /api/v1/runs/${DEMO_RUN_ID}/evidence (Bearer API key) — Slack channel evidence" \
  "curl -fsS -H 'Authorization: Bearer ${API_KEY}' http://localhost:${RUNTIME_PORT}/api/v1/runs/${DEMO_RUN_ID}/evidence | grep -q channel.slack"

step "loop-engine-runtime write surface (:${RUNTIME_PORT}) — RT-20c"
# Read the bare status code from each write endpoint so we can assert that the
# correct envelope (401/422/404) flows out — no body assertions required.
status() {
  curl -s -o /dev/null -w '%{http_code}' "$@"
}
check "POST /api/v1/loops without Authorization → 401" \
  "[ \"\$(status -X POST -H 'Content-Type: application/json' --data '{}' http://localhost:${RUNTIME_PORT}/api/v1/loops)\" = '401' ]"
check "POST /api/v1/loops with empty body (authed) → 422" \
  "[ \"\$(status -X POST -H 'Authorization: Bearer ${API_KEY}' -H 'Content-Type: application/json' --data '{}' http://localhost:${RUNTIME_PORT}/api/v1/loops)\" = '422' ]"
check "POST /api/v1/loops with unknown loopId (authed) → 404" \
  "[ \"\$(status -X POST -H 'Authorization: Bearer ${API_KEY}' -H 'Content-Type: application/json' --data '{\"loopId\":\"nonexistent.loop\",\"payload\":{}}' http://localhost:${RUNTIME_PORT}/api/v1/loops)\" = '404' ]"
check "POST /api/v1/loops/missing/start (authed) → 404" \
  "[ \"\$(status -X POST -H 'Authorization: Bearer ${API_KEY}' http://localhost:${RUNTIME_PORT}/api/v1/loops/missing/start)\" = '404' ]"
check "POST /api/v1/loops/missing/transition (authed) → 404" \
  "[ \"\$(status -X POST -H 'Authorization: Bearer ${API_KEY}' -H 'Content-Type: application/json' --data '{\"signalId\":\"s\",\"actor\":{\"id\":\"u\",\"type\":\"human\"}}' http://localhost:${RUNTIME_PORT}/api/v1/loops/missing/transition)\" = '404' ]"
check "POST /api/v1/loops/missing/cancel (authed) → 404" \
  "[ \"\$(status -X POST -H 'Authorization: Bearer ${API_KEY}' http://localhost:${RUNTIME_PORT}/api/v1/loops/missing/cancel)\" = '404' ]"

step "studio (:${STUDIO_PORT})"
check "GET / (200)" \
  "curl -fsS -o /dev/null -w '%{http_code}' http://localhost:${STUDIO_PORT}/ | grep -q 200"
check "GET /runs/${DEMO_RUN_ID}/dual-surface (200)" \
  "curl -fsS -o /dev/null -w '%{http_code}' http://localhost:${STUDIO_PORT}/runs/${DEMO_RUN_ID}/dual-surface | grep -q 200"

printf "\n[verify] %d passed, %d failed\n" "$PASS_COUNT" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  printf "[verify] Some checks failed. Inspect logs:\n"
  printf "  docker compose -f deploy/compose/docker-compose.yml logs -f loop-engine-runtime\n"
  printf "  docker compose -f deploy/compose/docker-compose.yml logs -f registry-loop\n"
  printf "  docker compose -f deploy/compose/docker-compose.yml logs -f studio\n"
  exit 1
fi

printf "[verify] Quickstart OK — open http://localhost:%s/runs/%s/dual-surface\n" \
  "$STUDIO_PORT" "$DEMO_RUN_ID"

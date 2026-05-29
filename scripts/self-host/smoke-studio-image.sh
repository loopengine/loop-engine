#!/usr/bin/env bash
# RT-22 — Smoke-test the Studio production image locally.
#
# Usage:
#   bash scripts/self-host/smoke-studio-image.sh
#
# Requires a built image (see `make studio-image-build`).
#
# Uses STUDIO_PROVIDER=mock so /runs/run_demo_01/dual-surface renders without a
# live loop-engine-runtime. Image defaults remain http for compose/k8s deployment.

set -euo pipefail

IMAGE="${STUDIO_IMAGE:-studio-app:local}"
HOST_PORT="${STUDIO_IMAGE_PORT:-3025}"
CONTAINER_PORT=3020
MOCK_RUN_ID="run_demo_01"

echo "[smoke-studio-image] starting ${IMAGE} on localhost:${HOST_PORT} (mock provider)..."
cid="$(docker run -d --rm \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -e STUDIO_PROVIDER=mock \
  "${IMAGE}")"

cleanup() {
  docker stop "${cid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

root_ok=0
dual_surface_ok=0

for i in $(seq 1 30); do
  if [ "$root_ok" -eq 0 ] && curl -fsS "http://localhost:${HOST_PORT}/" 2>/dev/null | grep -q "OSS Studio shell"; then
    root_ok=1
    echo "[smoke-studio-image] OK — / after ${i} attempt(s)"
  fi
  if [ "$root_ok" -eq 1 ] && curl -fsS "http://localhost:${HOST_PORT}/runs/${MOCK_RUN_ID}/dual-surface" >/dev/null 2>&1; then
    dual_surface_ok=1
    echo "[smoke-studio-image] OK — /runs/${MOCK_RUN_ID}/dual-surface after ${i} attempt(s)"
    exit 0
  fi
  echo "[smoke-studio-image] waiting... (${i}/30)"
  sleep 2
done

echo "[smoke-studio-image] FAIL — root=${root_ok} dual-surface=${dual_surface_ok}"
docker logs "${cid}" 2>&1 | tail -80 || true
exit 1

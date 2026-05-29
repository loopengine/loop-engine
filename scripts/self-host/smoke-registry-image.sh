#!/usr/bin/env bash
# RT-22 — Smoke-test the registry-loop production image locally.
#
# Usage:
#   bash scripts/self-host/smoke-registry-image.sh
#
# Requires a built image (see `make registry-image-build`).

set -euo pipefail

IMAGE="${REGISTRY_IMAGE:-registry-loop:local}"
HOST_PORT="${REGISTRY_IMAGE_PORT:-3014}"
CONTAINER_PORT=3011

echo "[smoke-registry-image] starting ${IMAGE} on localhost:${HOST_PORT}..."
cid="$(docker run -d --rm \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -e REGISTRY_REPOSITORY=memory \
  -e PUBLISHER_TOKEN_SECRET=self-host-publisher-token \
  "${IMAGE}")"

cleanup() {
  docker stop "${cid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

health_ok=0
catalog_ok=0

for i in $(seq 1 30); do
  if [ "$health_ok" -eq 0 ] && curl -fsS "http://localhost:${HOST_PORT}/v0/health" >/dev/null 2>&1; then
    health_ok=1
    echo "[smoke-registry-image] OK — /v0/health after ${i} attempt(s)"
  fi
  if [ "$health_ok" -eq 1 ] && curl -fsS "http://localhost:${HOST_PORT}/v0/loops" 2>/dev/null | grep -q 'scm.replenishment'; then
    catalog_ok=1
    echo "[smoke-registry-image] OK — /v0/loops catalog after ${i} attempt(s)"
    exit 0
  fi
  echo "[smoke-registry-image] waiting... (${i}/30)"
  sleep 2
done

echo "[smoke-registry-image] FAIL — health=${health_ok} catalog=${catalog_ok}"
docker logs "${cid}" 2>&1 | tail -80 || true
exit 1

#!/usr/bin/env bash
# RT-22 — Smoke-test the loop-engine-runtime production image locally.
#
# Usage:
#   bash scripts/self-host/smoke-runtime-image.sh
#
# Requires a built image (see `make runtime-image-build`).

set -euo pipefail

IMAGE="${RUNTIME_IMAGE:-loop-engine-runtime:local}"
HOST_PORT="${RUNTIME_IMAGE_PORT:-3013}"
CONTAINER_PORT=3012

echo "[smoke-runtime-image] starting ${IMAGE} on localhost:${HOST_PORT}..."
cid="$(docker run -d --rm \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -e LOOP_ENGINE_AUTH_MODE=memory \
  "${IMAGE}")"

cleanup() {
  docker stop "${cid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for i in $(seq 1 30); do
  if curl -fsS "http://localhost:${HOST_PORT}/api/v1/metadata/connections" 2>/dev/null | grep -q 'channel.slack'; then
    echo "[smoke-runtime-image] OK — metadata/connections healthy after ${i} attempt(s)"
    exit 0
  fi
  echo "[smoke-runtime-image] waiting... (${i}/30)"
  sleep 2
done

echo "[smoke-runtime-image] FAIL — metadata endpoint did not become ready"
docker logs "${cid}" 2>&1 | tail -80 || true
exit 1

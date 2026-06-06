---
"@loop-engine/registry-client": patch
---

Registry-client gains the OSS seam's registry-loop `v0` adapter and its contract test surface. As
with observability, these landed on `main` after the `1.0.0-rc.0` publish, so the registry is stale
relative to the source tree. This patch lands an `rc.1` that matches `main`.

Additive only — no existing export changes shape; `patch` iterates within the `1.0.0` RC line.

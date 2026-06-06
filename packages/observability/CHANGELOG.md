# Changelog

## 1.0.0-rc.1

### Patch Changes

- Observability gains the OSS trace/audit-read surface landed by the OSS seam: `TraceStore` /
  `MemoryTraceStore`, the trace timeline + trace types, `audit-read`, and the
  `RUNTIME_API_CONTRACT_VERSION` constant. These exports exist on `main` but were never published —
  the registry's `1.0.0-rc.0` predates them, which left `@loop-engine/studio-client` (a consumer of
  `RUNTIME_API_CONTRACT_VERSION`) broken against the registry. This patch lands an `rc.1` so the
  published surface matches `main`.

  Additive only — no existing export changes shape; the bump is `patch` to iterate within the `1.0.0`
  RC line (the eventual stable `1.0.0` is governed by the consumed surface-reconciliation changesets).

## 1.0.0-rc.0 (RT-04 + RT-05)

### Added (RT-05)

- Canonical audit/event read DTOs: `RunHistoryReadResponse`, `RunEvidenceReadResponse`, `RunReplaySummaryReadResponse`, etc.
- `RUNTIME_API_CONTRACT_VERSION` constant aligned with RT-01 freeze.

## 1.0.0-rc.0 (RT-04)

### Added

- Canonical `TraceStore`, `TraceRecord`, and `MemoryTraceStore` (from forge `@bd-forge/loopengine-observability` substrate).
- Trace-derived timeline helpers: `buildTimelineFromTrace`, `computeMetricsFromTrace`, `getStateResidencyFromTrace`, `replayLoopFromTrace`.
- Instance-based `buildTimeline`, `computeMetrics`, `replayLoop` (npm surface preserved).

### Changed

- `@bd-forge/loopengine-observability` is now a thin re-export shim; new code should import from `@loop-engine/observability`.
- `@betterdata/database-loops` imports trace types from this package (hosted `PostgresTraceStore` behavior unchanged).

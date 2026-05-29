# Changelog

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

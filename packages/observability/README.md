# @loop-engine/observability

Loop Engine observability: **trace store contract**, in-memory trace storage, and timeline/metrics helpers.

## Trace contract (canonical)

Use these types for any `TraceStore` implementation (OSS `MemoryTraceStore`, hosted `PostgresTraceStore`):

```ts
import {
  MemoryTraceStore,
  type TraceRecord,
  type TraceStore,
} from "@loop-engine/observability";
```

## Trace-derived timelines

From persisted `TraceRecord[]` (e.g. after `getRunTrace`):

```ts
import { buildTimelineFromTrace, computeMetricsFromTrace } from "@loop-engine/observability";
```

## Instance-based timelines (runtime history)

From `@loop-engine/core` `LoopInstance` + `TransitionRecord[]`:

```ts
import { buildTimeline, computeMetrics, replayLoop } from "@loop-engine/observability";
```

## Forge alias package

`@bd-forge/loopengine-observability` re-exports this package for backward compatibility.

## License

Apache-2.0

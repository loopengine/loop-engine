# @loop-engine/studio-ui

Presentational Loop Engine Studio primitives for timelines, evidence, and replay views.

**RT-06 scope:** fixtures and components only — no production API wiring, no Prisma/database imports, no auth.

## Install

```bash
pnpm add @loop-engine/studio-ui @loop-engine/observability react react-dom
```

Import styles once in your host app:

```ts
import "@loop-engine/studio-ui/styles.css";
```

## Usage (mocked data)

```tsx
import {
  StudioPrimitivesDemo,
  RunSummaryCard,
  mockStudioRunBundle,
} from "@loop-engine/studio-ui";

export function Preview() {
  const { detail, history, timeline, evidence, replaySummary } = mockStudioRunBundle;
  return <StudioPrimitivesDemo />;
}
```

Props align with **RT-05** DTOs from `@loop-engine/observability` (`RunDetailReadResponse`, `RunHistoryReadResponse`, etc.).

## Components

| Component | Purpose |
|-----------|---------|
| `RunSummaryCard` | Run metadata card |
| `RunHistoryPanel` | Audit event list |
| `EvidencePanel` | Per-step evidence JSON |
| `LoopTimeline` | Transitions + guard results + residency |
| `ReplaySummaryPanel` | Replay metrics + sequence validation |
| `ActorAttribution` | Actor id/type badge |
| `GuardResultList` | Guard pass/fail list |
| `StudioStateFrame` | Loading / empty / error wrapper |
| `StudioPrimitivesDemo` | All primitives with `mockStudioRunBundle` |

## Production wiring

HTTP client + hosted/OSS shells: **RT-07** / **RT-08**. Do not add `fetch` here.

## License

Apache-2.0

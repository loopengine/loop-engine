# @loop-engine/studio-client

Typed Studio client for Loop Engine **RT-05** canonical run read APIs.

```
Studio UI (@loop-engine/studio-ui)  →  props
Studio Client (this package)        →  HTTP or mock provider
Hosted runtime                      →  GET /api/v1/runs/{id}/*
```

## Providers

| Provider | Use |
|----------|-----|
| `HttpStudioProvider` | Live hosted-loops; caller supplies `headers` (no embedded auth) |
| `MockStudioProvider` | Fixtures / Storybook / tests |

## Example (mock + RT-06 UI)

```tsx
import { createStudioRunClient, createMockStudioProviderFromBundle } from "@loop-engine/studio-client";
import { mockStudioRunBundle } from "@loop-engine/studio-ui";
import { RunSummaryCard, EvidencePanel, type StudioViewStatus } from "@loop-engine/studio-ui";

async function RunView({ runId }: { runId: string }) {
  const client = createStudioRunClient(createMockStudioProviderFromBundle(mockStudioRunBundle));
  const detail = await client.getRun(runId);
  const evidence = await client.getRunEvidence(runId);
  const status: StudioViewStatus = "ready";

  return (
    <>
      <RunSummaryCard run={detail.run} traceStepCount={detail.traceStepCount} />
      <EvidencePanel items={evidence.items} status={status} />
    </>
  );
}
```

## Example (HTTP)

```ts
import { HttpStudioProvider, createStudioRunClient } from "@loop-engine/studio-client";

const client = createStudioRunClient(
  new HttpStudioProvider({
    baseUrl: process.env.LOOP_ENGINE_URL ?? "http://localhost:3012",
    headers: () => ({ Authorization: `Bearer ${token}` }),
  }),
);

const bundle = await client.getRunBundle("run-id");
```

## API map (RT-05)

| Method | HTTP |
|--------|------|
| `getRun` | `GET /api/v1/runs/{id}` |
| `getRunHistory` | `GET /api/v1/runs/{id}/history` |
| `getRunEvidence` | `GET /api/v1/runs/{id}/evidence` |
| `getRunTimeline` | `GET /api/v1/runs/{id}/timeline` |
| `getReplaySummary` | `GET /api/v1/runs/{id}/replay-summary` |

DTOs are imported from `@loop-engine/observability` only.

## License

Apache-2.0

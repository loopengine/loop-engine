# @loop-engine/loop-status-client

OSS client for the **Boss Loops Cloud loop-status API** — subscribe to a live
stream of loop-state transitions (SSE) and pull/replay them from a cursor, all
over the OSS [`@loop-engine/events`](../events) `LoopEvent` types.

> Boss Loops OSS is distributed as the `@loop-engine/*` packages; this is the
> distribution-level client for the hosted loop-status surface (BL-BRAND-01).

It contains **no proprietary logic**: it is an HTTP/SSE client over a Cloud API
with public event types, so any consumer (first- or third-party) can subscribe to
loop status. The Cloud API itself is the proprietary surface.

## Design

- **Pull is the backbone, stream is convenience.** `pullTransitions` is the
  durable, cursor-ordered read; `streamLoopState` is a best-effort live push of
  the same events. A consumer resumes from its last cursor and never misses a
  transition — "degradation is time, not data".
- **Auth is supplied, never minted.** You pass `getToken()`; the client sends it
  as a Bearer token. Token issuance is platform-only (PLAT-AUTH-01) — this client
  has no knowledge of signing or org claims, by design.

## Usage

```ts
import { createLoopStatusClient, cursorOf } from "@loop-engine/loop-status-client";

const client = createLoopStatusClient({
  baseUrl: "https://cloud.bossloops.example",
  getToken: async () => fetchServiceToken(), // your PLAT-AUTH-01 token source
});

// Durable catch-up from a stored cursor.
let cursor: string | null = loadCursor();
let page = await client.pullTransitions({ organizationId, since: cursor, limit: 200 });
for (const event of page.events) handle(event);
cursor = page.nextCursor;
while (page.hasMore) {
  page = await client.pullTransitions({ organizationId, since: cursor });
  for (const event of page.events) handle(event);
  cursor = page.nextCursor;
}

// Live stream, resuming from the same cursor.
const controller = new AbortController();
await client.streamLoopState({
  organizationId,
  since: cursor,
  signal: controller.signal,
  onEvent: (event) => {
    handle(event);
    cursor = cursorOf(event) ?? cursor; // persist for resume
  },
  onResyncRequired: async (nextCursor) => {
    // history exceeded one catch-up page — drain via pull, then the stream continues live
    cursor = nextCursor;
  },
});
```

## API

- `createLoopStatusClient(options)` → `{ pullTransitions, streamLoopState }`
- `pullTransitions({ organizationId, since?, limit?, signal? })` →
  `{ events, nextCursor, hasMore }`
- `streamLoopState({ organizationId, since?, signal?, onEvent, onPing?, onResyncRequired?, onError? })`
- `cursorOf(event)` → the resume cursor for a `LoopEvent`
- `LoopStatusError` — thrown on non-2xx, carries `status`

## Build / test

- `pnpm build` — tsup (esm + cjs + dts)
- `pnpm test` — vitest (mocked fetch; no network)

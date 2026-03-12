# @loop-engine/adapter-openclaw

`@loop-engine/adapter-openclaw` forwards Loop Engine lifecycle events to an OpenClaw gateway over WebSocket while still emitting events on a local bus.

## Install

```bash
npm install @loop-engine/adapter-openclaw ws
```

## Connection strategy

The adapter connects to the OpenClaw gateway WebSocket at `ws://127.0.0.1:18789` by default.

### Scenario A — Local / self-hosted

Run the gateway as a local process alongside your Loop Engine runtime (standard dev and on-prem setup):

```ts
import { OpenClawEventBus } from "@loop-engine/adapter-openclaw";

const bus = new OpenClawEventBus({
  channel: "whatsapp",
  target: "+15551234567"
});
```

### Scenario B — Serverless / edge (Vercel, Cloudflare Workers, AWS Lambda)

A persistent WebSocket to a local gateway is not compatible with stateless serverless functions.

- Option 1: run this adapter in a long-lived sidecar/worker process (recommended).
- Option 2: use a hosted OpenClaw gateway URL and pass it to `gatewayUrl`.

> ⚠️ Do not instantiate `OpenClawEventBus` inside a Vercel serverless function.  
> The WebSocket connection will be dropped on function termination.  
> See [deployment guide](https://loopengine.io/docs/examples/openclaw) for the sidecar pattern.

## Required: channel and target

OpenClaw send delivery requires **both** `channel` and `target`.  
`channel` alone is insufficient and delivery can fail silently.

```ts
import { OpenClawEventBus } from "@loop-engine/adapter-openclaw";
import { InMemoryEventBus } from "@loop-engine/events";

const innerBus = new InMemoryEventBus();

const bus = new OpenClawEventBus(innerBus, {
  gatewayUrl: "ws://127.0.0.1:18789",
  channel: "whatsapp", // delivery channel
  target: "+1-555-000-0001", // recipient: phone, username, or room ID
  idempotencyKey: () => crypto.randomUUID()
});
```

Supported `channel` values and `target` semantics:

- `whatsapp` -> E.164 phone number
- `telegram` -> chat ID or `@username`
- `slack` -> channel ID or user ID
- `discord` -> channel ID

## Prerequisites

- OpenClaw gateway reachable at `ws://127.0.0.1:18789` (or custom URL)
- A configured destination `channel` and recipient `target` supported by OpenClaw

## Usage

```ts
import { createLoopSystem } from "@loop-engine/sdk";
import { OpenClawEventBus } from "@loop-engine/adapter-openclaw";

const eventBus = new OpenClawEventBus({
  channel: "whatsapp",
  target: "+15551234567",
  events: ["loop.transition.executed", "loop.completed", "loop.guard.failed"],
  approvalStates: ["PENDING_BUYER_APPROVAL"]
});

const system = await createLoopSystem({ loops: [/* loop definitions */], eventBus });
```

## Approval detection

By default, transitions to states matching `PENDING` or `APPROVAL` trigger an approval request message. Set `approvalStates` to override this with explicit state names.

## Cleanup

Call `disconnect()` on shutdown to clear reconnect timers and close the socket cleanly.

# @loop-engine/adapter-openclaw

`@loop-engine/adapter-openclaw` forwards Loop Engine lifecycle events to an OpenClaw gateway over WebSocket while still emitting events on a local bus.

## Install

```bash
npm install @loop-engine/adapter-openclaw ws
```

## Prerequisites

- OpenClaw gateway reachable at `ws://127.0.0.1:18789` (or custom URL)
- A configured destination `channel` and recipient `target` supported by OpenClaw

## Connection model

This adapter is designed for long-running Node.js processes that can keep a persistent WebSocket connection to the OpenClaw gateway.

- Local/dev: run OpenClaw gateway on the same host and use the default `ws://127.0.0.1:18789`.
- Hosted/server: point `gatewayUrl` to a reachable OpenClaw gateway endpoint.
- Serverless/edge: this adapter is not a fit for short-lived runtimes that cannot keep persistent sockets.

## Usage

```ts
import { createLoopSystem } from "@loop-engine/sdk";
import { OpenClawEventBus } from "@loop-engine/adapter-openclaw";

const bus = new OpenClawEventBus({
  channel: "whatsapp",
  target: "+15551234567",
  events: ["loop.transition.executed", "loop.completed", "loop.guard.failed"],
  approvalStates: ["PENDING_BUYER_APPROVAL"]
});

const system = await createLoopSystem({
  loops: [/* loop definitions */],
  eventBus: bus
});
```

`channel` selects the OpenClaw transport (for example `whatsapp`, `telegram`, `slack`), and `target` is the actual destination identifier for that channel.

## Approval detection

By default, transitions to states matching `PENDING` or `APPROVAL` trigger an approval request message. Set `approvalStates` to override this with explicit state names.

## Cleanup

Call `disconnect()` on shutdown to clear reconnect timers and close the socket cleanly.

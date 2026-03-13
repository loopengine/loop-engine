# @loop-engine/events

[![npm](https://img.shields.io/npm/v/@loop-engine/events.svg)](https://www.npmjs.com/package/@loop-engine/events)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Typed event definitions and factory functions for Loop Engine runtime events.

## Install

```bash
npm install @loop-engine/events
```

## Quick Start

```ts
import { createLoopStartedEvent, createLoopTransitionExecutedEvent, type LoopEvent } from "@loop-engine/events";

const started = createLoopStartedEvent({
  loopId: "expense.approval" as never,
  aggregateId: "EXP-1" as never,
  initialState: "submitted" as never,
  actor: { type: "human", id: "manager@acme.com" as never },
  definition: { loopId: "expense.approval" as never, version: "1.0.0", name: "Expense Approval" }
});

const transitioned: LoopEvent = createLoopTransitionExecutedEvent({
  loopId: started.loopId,
  aggregateId: started.aggregateId,
  transitionId: "approve" as never,
  fromState: "submitted" as never,
  toState: "approved" as never,
  signal: "approve" as never,
  actor: started.actor
});
```

## Documentation link

https://loopengine.io/docs/packages/events

## License

Apache-2.0 © Better Data, Inc.

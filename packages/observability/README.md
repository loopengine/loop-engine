# @loop-engine/observability

[![npm](https://img.shields.io/npm/v/@loop-engine/observability.svg)](https://www.npmjs.com/package/@loop-engine/observability)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Loop timeline reconstruction, replay validation, and observability helpers for Loop Engine.

## Install

```bash
npm install @loop-engine/observability
```

## Quick Start

```ts
import { buildTimeline, replayLoop } from "@loop-engine/observability";

const timeline = buildTimeline(instance, history);
const replay = replayLoop(definition, history);

console.log({
  aggregateId: timeline.aggregateId,
  durationMs: timeline.durationMs,
  transitions: timeline.transitions.length,
  replayValid: replay.valid
});
```

## Documentation link

https://loopengine.io/docs/packages/observability

## License

Apache-2.0 © Better Data, Inc.

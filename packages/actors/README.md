# @loop-engine/actors

[![npm](https://img.shields.io/npm/v/@loop-engine/actors.svg)](https://www.npmjs.com/package/@loop-engine/actors)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Actor types, authorization logic, and AI evidence helpers for Loop Engine transitions.

## Install

```bash
npm install @loop-engine/actors
```

## Quick Start

```ts
import { isAuthorized, buildAIActorEvidence } from "@loop-engine/actors";

const authorized = isAuthorized(
  { type: "human", id: "manager@acme.com" as never },
  { transitionId: "approve" as never, from: "pending" as never, to: "approved" as never, signal: "approve" as never, allowedActors: ["human"] }
);

const evidence = await buildAIActorEvidence({
  modelId: "gpt-4o",
  provider: "openai",
  reasoning: "Demand exceeds reorder point",
  confidence: 0.88,
  prompt: "Recommend replenishment action."
});
```

## Documentation link

https://loopengine.io/docs/packages/actors

## License

Apache-2.0 © Better Data, Inc.

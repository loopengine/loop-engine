# @loop-engine/adapter-grok

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-grok.svg)](https://www.npmjs.com/package/@loop-engine/adapter-grok)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Grok (xAI) adapter for Loop Engine - use Grok as a governed AI actor via xAI's OpenAI-compatible API.

## Install

```bash
npm install @loop-engine/adapter-grok openai
```

## Quick Start

```ts
import { createGrokActorAdapter } from "@loop-engine/adapter-grok";

const adapter = createGrokActorAdapter(process.env.XAI_API_KEY!, {
  modelId: "grok-3",
  confidenceThreshold: 0.75
});

const { actor, decision } = await adapter.createSubmission({
  loopId: "procurement",
  loopName: "SCM Procurement",
  currentState: "pending_analysis",
  availableSignals: [{ signalId: "submit_recommendation", name: "Submit Recommendation" }],
  instruction: "Analyze demand and recommend action"
});
```

## Documentation link

https://loopengine.io/docs/integrations/grok

## License

Apache-2.0 © Better Data, Inc.

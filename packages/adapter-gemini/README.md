# @loop-engine/adapter-gemini

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-gemini.svg)](https://www.npmjs.com/package/@loop-engine/adapter-gemini)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Google Gemini adapter for Loop Engine - use Gemini models as governed AI actors.

## Install

```bash
npm install @loop-engine/adapter-gemini @google/generative-ai
```

## Quick Start

```ts
import { createGeminiActorAdapter } from "@loop-engine/adapter-gemini";

const adapter = createGeminiActorAdapter(process.env.GOOGLE_AI_API_KEY!, {
  modelId: "gemini-1.5-pro",
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

https://loopengine.io/docs/integrations/gemini

## License

Apache-2.0 © Better Data, Inc.

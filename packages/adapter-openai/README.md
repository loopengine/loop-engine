# @loop-engine/adapter-openai

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-openai.svg)](https://www.npmjs.com/package/@loop-engine/adapter-openai)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

OpenAI adapter for Loop Engine - use GPT models as governed AI actors.

## Install

```bash
npm install @loop-engine/adapter-openai openai
```

## Quick Start

```ts
import { createOpenAIActorAdapter } from "@loop-engine/adapter-openai";

const adapter = createOpenAIActorAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o"
});

const submission = await adapter.createSubmission({
  signal: "submit_recommendation" as never,
  actorId: "agent:openai" as never,
  prompt: "Analyze inventory and recommend replenishment"
});
```

## Documentation link

https://loopengine.io/docs/integrations/openai

## License

Apache-2.0 © Better Data, Inc.

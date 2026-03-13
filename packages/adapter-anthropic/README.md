# @loop-engine/adapter-anthropic

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-anthropic.svg)](https://www.npmjs.com/package/@loop-engine/adapter-anthropic)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Anthropic Claude adapter for Loop Engine - use Claude as a governed AI actor with confidence and evidence capture.

## Install

```bash
npm install @loop-engine/adapter-anthropic @anthropic-ai/sdk
```

## Quick Start

```ts
import { createAnthropicActorAdapter } from "@loop-engine/adapter-anthropic";

const adapter = createAnthropicActorAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: "claude-3-5-sonnet-latest"
});

const submission = await adapter.createSubmission({
  signal: "submit_recommendation" as never,
  actorId: "agent:claude" as never,
  prompt: "Analyze demand and recommend PO action"
});
```

## Documentation link

https://loopengine.io/docs/integrations/anthropic

## License

Apache-2.0 © Better Data, Inc.

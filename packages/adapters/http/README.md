# @loop-engine/adapter-http

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-http.svg)](https://www.npmjs.com/package/@loop-engine/adapter-http)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Generic HTTP event adapter for Loop Engine - post loop events to REST/webhook endpoints.

## Install

```bash
npm install @loop-engine/adapter-http
```

## Quick Start

```ts
import { httpEventBus } from "@loop-engine/adapter-http";

const eventBus = httpEventBus({
  webhookUrl: "https://api.example.com/loop-events",
  headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
  retries: 3
});
```

## Documentation link

https://loopengine.io/docs/integrations/http

## License

Apache-2.0 © Better Data, Inc.

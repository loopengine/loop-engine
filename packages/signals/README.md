# @loop-engine/signals

[![npm](https://img.shields.io/npm/v/@loop-engine/signals.svg)](https://www.npmjs.com/package/@loop-engine/signals)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Signal schemas and registry utilities for validating Loop Engine signal payloads.

## Install

```bash
npm install @loop-engine/signals
```

## Quick Start

```ts
import { z } from "zod";
import { SignalRegistry } from "@loop-engine/signals";

const registry = new SignalRegistry();
registry.register({
  signalId: "submit_recommendation" as never,
  name: "Submit Recommendation",
  schema: z.object({ sku: z.string(), demandChange: z.number() })
});

const ok = registry.validatePayload("submit_recommendation" as never, { sku: "SKU-1", demandChange: 0.82 });
```

## Documentation link

https://loopengine.io/docs/packages/signals

## License

Apache-2.0 © Better Data, Inc.

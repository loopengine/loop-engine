# @loop-engine/adapter-memory

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-memory.svg)](https://www.npmjs.com/package/@loop-engine/adapter-memory)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

In-memory storage adapter for Loop Engine - zero configuration for development and tests.

## Install

```bash
npm install @loop-engine/adapter-memory @loop-engine/sdk
```

## Quick Start

```ts
import { createLoopSystem, GuardRegistry } from "@loop-engine/sdk";
import { MemoryStore } from "@loop-engine/adapter-memory";

const guards = new GuardRegistry();
guards.registerBuiltIns();

const { engine } = await createLoopSystem({
  loops: [loopDefinition],
  store: new MemoryStore(),
  guards
});
```

## Documentation link

https://loopengine.io/docs/packages/adapter-memory

## License

Apache-2.0 © Better Data, Inc.

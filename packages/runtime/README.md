# @loop-engine/runtime

[![npm](https://img.shields.io/npm/v/@loop-engine/runtime.svg)](https://www.npmjs.com/package/@loop-engine/runtime)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

The Loop Engine runtime for governed loop lifecycle, transition execution, and event emission.

## Install

```bash
npm install @loop-engine/runtime @loop-engine/adapter-memory @loop-engine/guards
```

## Quick Start

```ts
import { createLoopEngine } from "@loop-engine/runtime";
import { createMemoryLoopStorageAdapter } from "@loop-engine/adapter-memory";
import { GuardRegistry } from "@loop-engine/guards";

const guardRegistry = new GuardRegistry();
guardRegistry.registerBuiltIns();
const registry = { get: () => loopDefinition, list: () => [loopDefinition] };
const system = createLoopEngine({ registry, storage: createMemoryLoopStorageAdapter(), guardRegistry });

await system.start({ loopId: "expense.approval" as never, aggregateId: "EXP-1" as never, actor: { type: "human", id: "manager@acme.com" as never } });
await system.transition({ aggregateId: "EXP-1" as never, transitionId: "approve" as never, actor: { type: "human", id: "manager@acme.com" as never } });
```

## Documentation link

https://loopengine.io/docs/packages/runtime

## License

Apache-2.0 © Better Data, Inc.

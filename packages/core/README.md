# @loop-engine/core

[![npm](https://img.shields.io/npm/v/@loop-engine/core.svg)](https://www.npmjs.com/package/@loop-engine/core)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Branded ID types, Zod schemas, and core domain types for Loop Engine.

## Install

```bash
npm install @loop-engine/core
```

## Quick Start

```ts
import { LoopIdSchema, LoopDefinitionSchema } from "@loop-engine/core";

const loopId = LoopIdSchema.parse("expense.approval");

const parsed = LoopDefinitionSchema.parse({
  loopId,
  version: "1.0.0",
  name: "Expense Approval",
  description: "Simple approval loop",
  states: [{ stateId: "submitted", label: "Submitted" }, { stateId: "approved", label: "Approved", terminal: true }],
  initialState: "submitted",
  transitions: [{ transitionId: "approve", from: "submitted", to: "approved", signal: "approve", allowedActors: ["human"] }]
});
```

## Documentation link

https://loopengine.io/docs/packages/core

## License

Apache-2.0 © Better Data, Inc.

# @loop-engine/guards

[![npm](https://img.shields.io/npm/v/@loop-engine/guards.svg)](https://www.npmjs.com/package/@loop-engine/guards)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Built-in guard implementations and guard evaluation pipeline for Loop Engine.

## Install

```bash
npm install @loop-engine/guards
```

## Quick Start

```ts
import { GuardRegistry, evaluateGuards } from "@loop-engine/guards";

const guards = new GuardRegistry();
guards.registerBuiltIns();

const summary = await evaluateGuards(
  [{ guardId: "human-only" as never, severity: "hard", evaluatedBy: "runtime", description: "Human only" }],
  { actor: { type: "human", id: "manager@acme.com" as never }, loopId: "expense.approval" as never, aggregateId: "EXP-1" as never, fromState: "pending" as never, toState: "approved" as never, signal: "approve" as never },
  guards
);
```

## Documentation link

https://loopengine.io/docs/packages/guards

## License

Apache-2.0 © Better Data, Inc.

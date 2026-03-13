# @loop-engine/sdk

[![npm](https://img.shields.io/npm/v/@loop-engine/sdk.svg)](https://www.npmjs.com/package/@loop-engine/sdk)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

The main Loop Engine SDK - runtime, DSL, guards, signals, events, and adapters in one import.

## Install

```bash
npm install @loop-engine/sdk
```

## Quick Start

```ts
import { createLoopSystem, parseLoopYaml } from "@loop-engine/sdk";

const loop = parseLoopYaml(`
loopId: expense.approval
version: "1.0.0"
name: Expense Approval
description: Demo
states: [{ stateId: submitted, label: Submitted }, { stateId: approved, label: Approved, terminal: true }]
initialState: submitted
transitions: [{ transitionId: approve, from: submitted, to: approved, signal: approve, allowedActors: [human] }]
`);

const { engine } = await createLoopSystem({ loops: [loop] });
await engine.startLoop({ loopId: "expense.approval" as never, aggregateId: "EXP-1" as never, actor: { type: "human", id: "manager@acme.com" as never } });
await engine.transition({ aggregateId: "EXP-1" as never, transitionId: "approve" as never, actor: { type: "human", id: "manager@acme.com" as never } });
```

## Documentation link

https://loopengine.io/docs/packages/sdk

## License

Apache-2.0 © Better Data, Inc.

# @loop-engine/dsl

[![npm](https://img.shields.io/npm/v/@loop-engine/dsl.svg)](https://www.npmjs.com/package/@loop-engine/dsl)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Parse, validate, and serialize Loop Engine loop definitions from YAML or TypeScript.

## Install

```bash
npm install @loop-engine/dsl
```

## Quick Start

```ts
import { parseLoopYaml, validateLoopDefinition } from "@loop-engine/dsl";

const definition = parseLoopYaml(`
loopId: expense.approval
version: "1.0.0"
name: Expense Approval
description: Demo
states: [{ stateId: submitted, label: Submitted }, { stateId: approved, label: Approved, terminal: true }]
initialState: submitted
transitions: [{ transitionId: approve, from: submitted, to: approved, signal: approve, allowedActors: [human] }]
`);

const result = validateLoopDefinition(definition);
console.log(result.valid, result.errors);
```

## Documentation link

https://loopengine.io/docs/packages/dsl

## License

Apache-2.0 © Better Data, Inc.

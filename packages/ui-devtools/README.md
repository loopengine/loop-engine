# @loop-engine/ui-devtools

[![npm](https://img.shields.io/npm/v/@loop-engine/ui-devtools.svg)](https://www.npmjs.com/package/@loop-engine/ui-devtools)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

React developer tools for visualizing Loop Engine state, transitions, and events during development.

## Install

```bash
npm install @loop-engine/ui-devtools react react-dom
```

## Quick Start

```tsx
import { DevtoolsPanel } from "@loop-engine/ui-devtools";

export function App() {
  return (
    <>
      <main>My Loop Engine app</main>
      <DevtoolsPanel apiUrl="http://localhost:3000/api" />
    </>
  );
}
```

## Documentation link

https://loopengine.io/docs/packages/ui-devtools

## License

Apache-2.0 © Better Data, Inc.

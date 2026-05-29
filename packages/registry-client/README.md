# @loop-engine/registry-client

Loop definition registry with local, HTTP, and Better Data adapters.

## Install

```bash
npm install @loop-engine/registry-client
```

## The default: local registry

For most use cases, pass your loop definitions directly to `createLoopSystem`:

```ts
import { createLoopSystem } from "@loop-engine/sdk";
import { procurement, replenishment } from "./loops";

const { engine } = await createLoopSystem({
  loops: [procurement, replenishment]
});
```

No registry needed. No external dependency. Works offline.

## Loading from a directory

```ts
import { localRegistry } from "@loop-engine/registry-client";
import { createLoopSystem } from "@loop-engine/sdk";

const { engine } = await createLoopSystem({
  loops: [],
  registry: localRegistry({ loopsDir: "./loops" })
});
```

Loop YAML files in `./loops/` are parsed and registered automatically.
Works in Node.js only. In browser, use the `definitions[]` array.

## Loading YAML from disk + inline definitions

```ts
import { localRegistry } from "@loop-engine/registry-client";

const registry = localRegistry({
  loopsDir: "./loops",
  definitions: [customLoop]
});
```

Inline definitions are applied after directory load and override matching loop IDs.
When IDs conflict, inline definitions take precedence over directory-loaded definitions.

## Registry v0 (canonical — registry-loop)

Production catalog services (`apps/registry-loop`, Better Data registry) implement the
[frozen v0 read contract](../../../docs/specs/loop-registry-api-v0.md). Use **`v0Registry`**:

```ts
import { v0Registry } from "@loop-engine/registry-client";

const registry = v0Registry({
  baseUrl: "http://localhost:3011", // origin only — no /loops suffix
  channel: "stable", // or "latest"
  headers: { Authorization: `Bearer ${token}` },
});
```

`v0Registry` implements `LoopRegistry` via `GET /v0/loops`, channel-aware loop summary,
and per-version artifact download. Publisher writes use registry-loop’s `/v0/publisher/*`
routes (not exposed on `LoopRegistry.register`).

## HTTP registry (legacy flat `/loops`)

```ts
import { httpRegistry } from "@loop-engine/registry-client";

const registry = httpRegistry({
  baseUrl: "https://your-registry.example.com",
  headers: { Authorization: `Bearer ${token}` }
});
```

**Deprecated** for registry-loop v0. Targets legacy flat `GET /loops/{id}` servers only
(see `docs/http-api.md`).

## Running a local registry server

To run the reference server locally:

```bash
cd packages/registry-client
npx ts-node examples/server.ts
```

Then point `httpRegistry` at it:

```ts
const registry = httpRegistry({ baseUrl: "http://localhost:3001" });
```

The reference server stores definitions in memory.
Replace the Map-based storage with a database for production.

## Better Data platform registry

```ts
import { betterDataRegistry } from "@loop-engine/registry-client/betterdata";

const registry = betterDataRegistry({
  apiKey: process.env.BD_API_KEY!,
  orgId: "your-org-id"
});
```

Requires a Better Data platform account.
See [betterdata.co/docs/loop-registry](https://betterdata.co/docs/loop-registry) for setup instructions.

## LoopRegistry interface

All adapters implement this interface. You can build your own:

```ts
import type { LoopRegistry } from "@loop-engine/registry-client";

const myRegistry: LoopRegistry = {
  get: async (id) => {
    return null;
  },
  getVersion: async (id, version) => {
    return null;
  },
  list: async (options) => {
    return [];
  },
  has: async (id) => {
    return false;
  },
  register: async (definition, options) => {},
  remove: async (id) => {
    return false;
  }
};
```

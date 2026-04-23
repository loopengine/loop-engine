# @loop-engine/adapter-postgres

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-postgres.svg)](https://www.npmjs.com/package/@loop-engine/adapter-postgres)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

PostgreSQL storage adapter for Loop Engine - persist loop state and transitions to Postgres.

## Install

```bash
npm install @loop-engine/adapter-postgres @loop-engine/sdk pg
```

## Quick Start

```ts
import { Pool } from "pg";
import { createLoopSystem } from "@loop-engine/sdk";
import { createSchema, postgresStore } from "@loop-engine/adapter-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await createSchema(pool);

const { engine } = await createLoopSystem({
  loops: [loopDefinition],
  store: postgresStore(pool)
});
```

## Documentation link

https://loopengine.io/docs/integrations/postgres

## License

Apache-2.0 © Better Data, Inc.

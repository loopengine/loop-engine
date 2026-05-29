// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * `@loop-engine/runtime-db` — OSS-subset Prisma client for the Loop Engine self-host runtime.
 *
 * Re-exports the generated Prisma client + types. Consumers wire it via a singleton:
 *
 *   import { PrismaClient } from "@loop-engine/runtime-db";
 *   const db = new PrismaClient({ datasources: { db: { url: process.env.LOOP_ENGINE_DATABASE_URL } } });
 *
 * Schema parity with the hosted package is enforced at CI by
 * `scripts/check-runtime-db-prefix.mjs`.
 */
export type {
  LoopInstance,
  LoopEvent,
  LoopDefinition,
  LoopTraceRecord,
  LoopRunSummary,
  LoopEngineApiKey,
  LoopEngineApiKeyStatus,
  Prisma,
} from "../generated/client/index.js";
export { PrismaClient } from "../generated/client/index.js";

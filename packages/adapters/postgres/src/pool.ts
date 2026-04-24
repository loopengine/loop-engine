// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.4: pool configuration factory.
 *
 * Wraps `pg.Pool` construction with loop-engine-opinionated defaults
 * for the four knobs that matter for production workloads:
 *
 *   - `max`                       — maximum concurrent connections
 *   - `idleTimeoutMillis`         — how long an idle client stays pooled
 *   - `connectionTimeoutMillis`   — how long `pool.connect()` waits
 *                                   before rejecting when the pool is
 *                                   saturated
 *   - `statement_timeout`         — server-side per-query timeout,
 *                                   wired via the libpq `options`
 *                                   connection parameter so it's
 *                                   applied at connection-init, not
 *                                   via a per-connect round-trip
 *
 * The factory is optional — consumers who want direct control can
 * still `new Pool(...)` themselves and pass it to `postgresStore`.
 * `createPool(...)` is the recommended path for consumers who want
 * the loop-engine defaults without having to remember them.
 *
 * Defaults are exported as `DEFAULT_POOL_OPTIONS` so consumers can
 * inspect them, compose overrides cleanly, or assert against them in
 * their own tests.
 */

import { Pool, type PoolConfig } from "pg";

/**
 * Configuration for `createPool(...)`. Extends `pg.PoolConfig` with a
 * first-class `statement_timeout` field — surfacing what would
 * otherwise be an opaque libpq `options: '-c statement_timeout=N'`
 * string so consumers can pass a numeric override without knowing the
 * incantation.
 *
 * All native `pg.PoolConfig` fields (connectionString, host, port,
 * user, password, database, ssl, etc.) pass through unchanged.
 */
export interface PoolOptions extends PoolConfig {
  /**
   * Server-side per-query timeout in milliseconds. Defaults to
   * `DEFAULT_POOL_OPTIONS.statement_timeout`. Applied via the libpq
   * `options` connection parameter (`-c statement_timeout=N`), so
   * every acquired client inherits the setting at connection time;
   * no per-query `SET statement_timeout` round-trip is issued.
   *
   * A consumer-supplied `options` string is preserved and extended
   * with the statement_timeout clause, so patterns like
   * `options: '-c search_path=public'` still work.
   */
  statement_timeout?: number;
}

/**
 * Loop-engine-opinionated defaults for the four pool knobs.
 *
 * Adjudicated at the SR-016 six-decision gate. Rationale per knob:
 *
 *   - `max: 10`                       — suitable for a single app
 *     instance talking to a standard Postgres deployment; consumers
 *     scaling to multiple app instances should raise this in
 *     coordination with `max_connections` on the server.
 *   - `idleTimeoutMillis: 30_000`     — 30s is long enough to amortize
 *     connection reuse under bursty traffic, short enough to reclaim
 *     connections during lulls without saturating the server's
 *     connection slot budget.
 *   - `connectionTimeoutMillis: 5_000` — 5s is the point at which
 *     "backpressure" is a more useful signal than "keep waiting."
 *     Pool exhaustion should fail loudly rather than silently
 *     accumulate request latency.
 *   - `statement_timeout: 30_000`     — 30s caps the worst-case query
 *     latency; runaway queries from a misconfigured index or a bad
 *     plan get killed server-side rather than holding a connection
 *     hostage indefinitely.
 */
export const DEFAULT_POOL_OPTIONS: Readonly<{
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
}> = Object.freeze({
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000
});

/**
 * Construct a `pg.Pool` with loop-engine-opinionated defaults.
 *
 * Consumer-supplied options override defaults (including explicit
 * `undefined`, which is normalized back to the default by
 * destructuring — so `createPool({ max: undefined })` still yields
 * `max: 10`, matching what a user would reasonably expect from a
 * "pass the default if I didn't set this" helper).
 *
 * The returned `pg.Pool` satisfies the adapter's `PgPoolLike`
 * contract structurally and can be passed directly to
 * `postgresStore(...)`, `runMigrations(...)`, or
 * `createSchema(...)`.
 *
 * Usage:
 *
 *   const pool = createPool({ connectionString: process.env.DB_URL });
 *   await runMigrations(pool);
 *   const store = postgresStore(pool);
 *
 * Consumer override example:
 *
 *   const pool = createPool({
 *     connectionString: process.env.DB_URL,
 *     max: 25,
 *     statement_timeout: 5_000,
 *     options: "-c search_path=app_schema"
 *   });
 */
export function createPool(options: PoolOptions = {}): Pool {
  const {
    max = DEFAULT_POOL_OPTIONS.max,
    idleTimeoutMillis = DEFAULT_POOL_OPTIONS.idleTimeoutMillis,
    connectionTimeoutMillis = DEFAULT_POOL_OPTIONS.connectionTimeoutMillis,
    statement_timeout = DEFAULT_POOL_OPTIONS.statement_timeout,
    options: consumerOptions,
    ...rest
  } = options;

  const statementTimeoutClause = `-c statement_timeout=${statement_timeout}`;
  const combinedOptions = consumerOptions
    ? `${consumerOptions} ${statementTimeoutClause}`
    : statementTimeoutClause;

  return new Pool({
    ...rest,
    max: max ?? DEFAULT_POOL_OPTIONS.max,
    idleTimeoutMillis: idleTimeoutMillis ?? DEFAULT_POOL_OPTIONS.idleTimeoutMillis,
    connectionTimeoutMillis:
      connectionTimeoutMillis ?? DEFAULT_POOL_OPTIONS.connectionTimeoutMillis,
    options: combinedOptions
  });
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.5: error classification surface for `@loop-engine/adapter-postgres`.
 *
 * Design posture (locked at operator adjudication):
 *
 *   - Minimal wrapper only. Routine pg errors pass through unchanged,
 *     including constraint-violation / data-error / access-error
 *     codes. Consumers who want typed handling of specific SQLSTATEs
 *     read them from the pg error's `.code` property.
 *
 *   - `PostgresStoreError` is a base class for adapter-originated
 *     errors (not a wrapping of every pg error). It carries the
 *     underlying cause and adds a `kind` discriminant for retry
 *     logic.
 *
 *   - `TransactionIntegrityError` is the one concrete subclass shipped
 *     at RC: it is thrown by `withTransaction` in exactly the cases
 *     where the adapter cannot confirm a definite terminal state for
 *     the transaction (see that class's docstring for the full rule).
 *
 *   - `classifyError` / `isTransientError` export the retry-decision
 *     logic. The "transient" list is deliberately narrow — connection
 *     errors plus a handful of Postgres-server-lifecycle codes plus
 *     deadlock. Err on the side of not retrying when uncertain;
 *     retry-loops on non-transient errors are worse than upfront
 *     failures.
 */

/**
 * Retry classification for a pg or adapter-originated error.
 *
 *   - `"transient"`  — the operation might succeed on retry with a
 *                      fresh connection (connection drops, server
 *                      lifecycle events, deadlocks).
 *   - `"permanent"`  — the operation will fail identically on retry
 *                      (constraint violations, data errors, syntax
 *                      errors, access-rule violations).
 *   - `"unknown"`    — the error doesn't fit either category; caller
 *                      should treat as permanent for retry-loop
 *                      safety unless context provides a reason not to.
 */
export type PostgresStoreErrorKind = "transient" | "permanent" | "unknown";

/**
 * Base class for adapter-originated errors. Carries the underlying
 * cause (typically a `pg.DatabaseError` or a Node connection error)
 * and tags a retry classification.
 *
 * Not thrown directly — instantiate a subclass. `TransactionIntegrityError`
 * is the one subclass shipped at RC.
 */
export class PostgresStoreError extends Error {
  public readonly kind: PostgresStoreErrorKind;

  constructor(
    message: string,
    options: { cause?: unknown; kind?: PostgresStoreErrorKind } = {}
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PostgresStoreError";
    this.kind = options.kind ?? classifyError(options.cause);
  }
}

/**
 * Thrown by `withTransaction` when the adapter cannot confirm a
 * definite terminal state for the transaction. Concretely:
 *
 *   1. `fn` threw, and the subsequent `ROLLBACK` also failed. The
 *      transaction's state at the server is indeterminate — it may
 *      have been rolled back by Postgres (on connection drop) or it
 *      may still be holding locks.
 *
 *   2. `fn` succeeded, but the `COMMIT` failed with a connection-level
 *      error. The transaction may have been committed server-side
 *      before the connection dropped (we never received the ACK) or
 *      it may have been rolled back. We don't know.
 *
 * `kind` is `"transient"` — a retry with a fresh connection might
 * succeed — but consumers are responsible for the retry's
 * idempotency story. Append-only writes (like `saveTransitionRecord`
 * against a unique `transitionId`) should either ride on upstream
 * idempotency guards or tolerate duplicates via their unique-
 * constraint surface.
 *
 * The original fn / COMMIT error is preserved as `.cause` for
 * diagnostic inspection.
 */
export class TransactionIntegrityError extends PostgresStoreError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause, kind: "transient" });
    this.name = "TransactionIntegrityError";
  }
}

/**
 * SQLSTATE codes classified as transient by the adapter. Deliberately
 * narrow:
 *
 *   - `40P01` (deadlock_detected) — Postgres aborted one transaction
 *     to break a deadlock; retry typically succeeds.
 *   - `57P01` (admin_shutdown)    — server told us to disconnect;
 *                                    retry against the restarted
 *                                    server works.
 *   - `57P02` (crash_shutdown)    — server crashed; retry after
 *                                    restart works.
 *   - `57P03` (cannot_connect_now)— server is starting up; retry
 *                                    after ready works.
 *
 * 40001 (serialization_failure) is NOT included at RC — it's real,
 * but only surfaces under `SERIALIZABLE` / `REPEATABLE READ`
 * isolation, and the adapter doesn't ship a way to opt into those
 * isolation levels yet. Add when the isolation-level surface lands.
 */
const TRANSIENT_PG_CODES: ReadonlySet<string> = new Set([
  "40P01",
  "57P01",
  "57P02",
  "57P03"
]);

/**
 * Node-level connection error codes classified as transient. These
 * don't originate from Postgres — they're TCP/DNS errors from the
 * Node pg driver's socket handling.
 */
const TRANSIENT_CONNECTION_CODES: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH"
]);

/**
 * Connection-terminated pg error patterns. pg surfaces mid-query
 * connection drops with messages like "Connection terminated
 * unexpectedly" or "Connection ended unexpectedly" and no `code`
 * field. Match the message as a fallback so these are classified
 * transient.
 */
const CONNECTION_TERMINATED_MESSAGE =
  /connection terminated|connection ended|connection unexpectedly/i;

/**
 * SQLSTATE format: five characters, A-Z / 0-9. Any code matching this
 * shape but not in the transient allowlist is classified `"permanent"`.
 * Non-matching codes fall through to `"unknown"` so we don't
 * misclassify custom error shapes from test doubles or wrappers.
 */
const SQLSTATE_SHAPE = /^[A-Z0-9]{5}$/;

/**
 * Classify an arbitrary error for retry-decision purposes.
 *
 * Handles:
 *   - `PostgresStoreError` instances (returns their tagged `.kind`)
 *   - `pg.DatabaseError`-shaped objects (reads `.code` SQLSTATE)
 *   - Node `SystemError`-shaped objects (reads `.code` ECONN*...)
 *   - pg's connection-terminated-without-code errors (message match)
 *   - Everything else → `"unknown"`
 */
export function classifyError(err: unknown): PostgresStoreErrorKind {
  if (!err || typeof err !== "object") return "unknown";

  if (err instanceof PostgresStoreError) return err.kind;

  const withShape = err as { code?: unknown; message?: unknown };

  if (typeof withShape.code === "string") {
    if (TRANSIENT_PG_CODES.has(withShape.code)) return "transient";
    if (TRANSIENT_CONNECTION_CODES.has(withShape.code)) return "transient";
    if (SQLSTATE_SHAPE.test(withShape.code)) return "permanent";
  }

  if (typeof withShape.message === "string") {
    if (CONNECTION_TERMINATED_MESSAGE.test(withShape.message)) return "transient";
  }

  return "unknown";
}

/**
 * Convenience predicate: `classifyError(err) === "transient"`.
 *
 * Use for retry loops: if true, the operation might succeed on a
 * fresh connection; if false, retrying will fail identically and
 * just accumulate latency.
 */
export function isTransientError(err: unknown): boolean {
  return classifyError(err) === "transient";
}

/**
 * Internal helper: was this error caused by the underlying connection
 * breaking (as opposed to a Postgres-reported semantic error)?
 *
 * Used by `withTransaction` to decide whether a COMMIT failure indicates
 * an indeterminate state (connection dropped → we never got the ACK)
 * or a definite rollback (deferred-constraint violation →
 * Postgres rolled the tx back and told us so).
 *
 * Distinct from `isTransientError`: deadlock (40P01) is transient but
 * isn't a connection error. This helper is specifically the "is
 * transaction state indeterminate?" signal, not the broader "is a
 * retry worth attempting?" signal.
 *
 * Not exported from the public API — consumers who need this granularity
 * can inspect `err.cause.code` against well-known values themselves.
 * Kept module-private to preserve a minimal public surface at RC.
 *
 * @internal
 */
export function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const withShape = err as { code?: unknown; message?: unknown };

  if (typeof withShape.code === "string") {
    if (TRANSIENT_CONNECTION_CODES.has(withShape.code)) return true;
    // Postgres server-lifecycle codes: functionally equivalent to a
    // connection drop — the server has told us the connection is no
    // longer usable.
    if (
      withShape.code === "57P01" ||
      withShape.code === "57P02" ||
      withShape.code === "57P03"
    ) {
      return true;
    }
  }

  if (typeof withShape.message === "string") {
    if (CONNECTION_TERMINATED_MESSAGE.test(withShape.message)) return true;
  }

  return false;
}

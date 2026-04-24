# `@loop-engine/adapter-postgres` — Design Notes

This document records load-bearing decisions about the adapter's
internal shape. Each decision below is a subtle choice that a future
PR could easily reshape without understanding the original rationale.
Contributors proposing a change to any named decision should link to
this document and argue against its rationale explicitly rather than
treating the current shape as arbitrary.

Scope: *why the code is shaped this way*. For *what the package does*
and *how to use it*, see `README.md`. For release history, see
`.changeset/` and the root `CHANGELOG.md`.

---

## Decision 1 — Two substantive findings during SR-016 share a root cause

**Context.** During SR-016 (the multi-sub-commit effort that brought
the adapter to production grade) two substantive bugs surfaced and
were resolved in-SR:

- **SF-SR016.3-1: Timestamp deserialization round-trip.**
  `asLoopInstance` / `asTransitionRecord` previously called
  `.toISOString()` on `new Date(asString(row.started_at))`. Postgres's
  default `pg` driver returns `Date` objects for `TIMESTAMPTZ` columns,
  so `asString` fell back to an empty string, `new Date("")` became
  `Invalid Date`, and `.toISOString()` threw `RangeError: Invalid
  time value`. The bug had shipped silently in 0.1.x because no
  integration test ever read back a persisted instance.
- **SF-SR016.5-1: Unhandled asynchronous `pg` client errors.**
  When Postgres terminates a backend mid-transaction (connection drop,
  administrative shutdown, backend-crash recovery) the `pg` client
  emits an `'error'` event on the underlying socket. With no
  listener attached, Node treats an emitted `'error'` event as an
  uncaught exception. The adapter's `withTransaction` helper had
  no handler, so a connection lost while the fn's promise was
  pending between queries would crash the process.

**Root cause (shared).** Both findings were pre-existing latent bugs
in adapter code paths that had shipped without integration-test
coverage exercising them. The SR-016 sub-commit traversal — which
added real-Postgres integration tests for migrations, transactions,
pool configuration, error classification, and index coverage —
happened to cover those paths for the first time, so the bugs
surfaced cleanly. Neither bug was introduced by SR-016 itself.

**Rule derived.** Any `@loop-engine/*` adapter package requires
integration-test coverage against its real backing system before
its first 1.0.0 promotion. See
`bd-forge-main/.cursor/rules/loop-engine-packaging.md` §"Pre-publish
verification requirements" for the canonical statement of this
policy.

**Implication for future maintainers.** If you are adding a new
code path to this adapter, the integration test that covers it must
exercise the adapter *through its public surface against a real
Postgres instance*. Unit tests with a mocked `pg.Pool` satisfy
"tests exist" but not "behavior verified." The `testcontainers`-
based harness in `src/__tests__/helpers/postgres.ts` is the
canonical pattern.

---

## Decision 2 — `statement_timeout` wiring via libpq `options` connection parameter

**What the code does.** `createPool(options)` translates a first-class
`statement_timeout: number` (milliseconds) into a libpq-style `-c
statement_timeout=N` clause appended to the connection's `options`
string. That string is passed to the Postgres server at connection-
establishment time. The server applies it as a server-side GUC on
the connection before the first query runs.

**Why not a per-query `SET statement_timeout`?** That approach has
a subtle correctness gap. A per-query `SET` requires the adapter to
issue the `SET` before every query the consumer runs — which means
either (a) wrapping every query with a two-statement transaction, or
(b) relying on timing that the connection is fresh-from-pool at each
query. Neither is robust: (a) breaks the adapter's ability to route
multiple queries through a single checked-out client (which
`withTransaction` requires); (b) has a race window between pool
checkout and `SET` application during which a runaway query can
bypass the timeout.

**Why not a `pg.Pool` event handler that issues `SET` on connect?**
This works but splits the configuration surface: the connection
options control some settings via libpq, and the pool's `connect`
handler controls others via SQL. Future maintainers adding
configuration find two sites to update. Wiring everything through
the libpq `options` string gives one configuration site per
connection parameter.

**Preservation of consumer-supplied `options`.** The factory
detects a consumer-supplied `options` string (e.g., `-c
search_path=app_schema`) and appends the `statement_timeout` clause
alongside rather than overwriting it. Ordering is consumer-first
then adapter-supplied — the adapter's clause wins on duplicate keys
(libpq's `-c` semantics apply later settings).

**What a future refactor should preserve.** Any change to the pool
factory's treatment of `statement_timeout` must (a) apply the timeout
at connection-establishment time (not per-query), (b) route all
adapter-supplied connection-level settings through the same
configuration surface, and (c) preserve consumer-supplied `options`
content without overwriting.

---

## Decision 3 — `withTransaction` installs a no-op `'error'` listener on the pg client

**What the code does.** Inside `withTransaction`, immediately after
acquiring a `pg.PoolClient` from the pool, the helper installs a
no-op handler for the `'error'` event on the client. Before
releasing the client in the `finally` block, the helper removes the
handler. Both operations are presence-guarded:

```ts
if (typeof client.on === "function") {
  client.on("error", asyncErrorNoop);
}
// ... transaction body ...
if (typeof client.off === "function") {
  client.off("error", asyncErrorNoop);
}
```

**Why it's required.** `pg` emits `'error'` events on the client
when the underlying socket fails asynchronously — most commonly
when Postgres terminates the backend (admin shutdown, crash
recovery, network drop). Without a listener attached, Node treats
the emitted `'error'` as an uncaught exception and crashes the
process. The error still reaches the adapter via the next query's
rejection (which is where the
`TransactionIntegrityError` wrapping per Decision 6 applies); the
`'error'` event is the asynchronous out-of-band notification, and
installing a no-op listener absorbs it so the synchronous query
path is the single point where the error is acted on.

**Why presence-guarding on `client.on` / `client.off` is
load-bearing.** The adapter types `PgClientLike` with `on` and `off`
as *optional* methods:

```ts
export type PgClientLike = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release(err?: Error | boolean): void;
  on?(event: "error", handler: (err: Error) => void): void;
  off?(event: "error", handler: (err: Error) => void): void;
};
```

Test doubles in `src/__tests__/` deliberately implement only
`query` and `release` — the minimum needed to exercise adapter
logic without pulling in `pg`'s full `EventEmitter` surface area.
Real `pg.PoolClient` instances have both methods. Presence-guarding
at the call site is what lets both satisfy `PgClientLike`.

**What a future refactor must preserve.** Any refactor that moves
the handler-installation code elsewhere (into a wrapper class, a
base class, a decorator) must preserve the presence-guarded
pattern. A refactor that "cleans up" `if (typeof client.on ===
"function")` by assuming `on` always exists will silently break
every narrow test double in the suite — and because the failure
mode is "tests crash before reporting," the breakage will be
diagnosed as flakiness rather than a structural regression.

---

## Decision 4 — Module split: `pool.ts`, `errors.ts`, `migrations/runner.ts`, plus `buildLoopStoreAgainst` factoring in `index.ts`

**What the code does.** The adapter's source tree is:

```
src/
├── index.ts             # public surface + LoopStore method impls
├── pool.ts              # createPool, DEFAULT_POOL_OPTIONS, PoolOptions
├── errors.ts            # PostgresStoreError, TransactionIntegrityError,
│                        # classifyError, isTransientError, internal helpers
├── migrations/
│   ├── runner.ts        # loadMigrations, runMigrations, Migration type
│   └── sql/             # versioned .sql files (001_, 002_, ...)
└── __tests__/           # integration + unit tests
```

`index.ts` contains a `buildLoopStoreAgainst(querier)` factory that
returns the five `LoopStore` methods given any `Querier` (where
`Querier = { query: (sql, values?) => Promise<{ rows }> }`). Both
the pool-backed store and the transactional `TransactionClient`
use the same factory with different queriers.

**Why the split.** Three forces shaped this layout:

- **`pool.ts` and `errors.ts` are independent concerns.** Pool
  configuration is about connection lifecycle; error classification
  is about response semantics. Mixing them into one file forces
  maintainers to load both mental models when working on either.
- **`migrations/runner.ts` is independent of the `LoopStore`
  surface entirely.** It's a generic SQL migration runner that
  happens to ship with this package. Keeping it in its own
  directory signals "this is a candidate for extraction if another
  adapter ever wants the same runner."
- **`buildLoopStoreAgainst` is a factoring, not a public surface.**
  It exists because the pool-backed and transaction-backed
  `LoopStore` implementations differ only in their querier. Without
  the factory, each of the five methods would be duplicated once
  for the pool case and once for the transaction case — and the
  two copies would drift. The factoring ensures they can't.

**What a future refactor should preserve.** New adapter-internal
concerns should get their own module when (a) the concern has its
own mental model, (b) it has stable internal boundaries, and
(c) it would meaningfully clutter `index.ts` if co-located. The
factoring on `Querier` should be preserved whenever the adapter
grows a new transactional context — don't duplicate
`LoopStore`-method bodies across querier contexts.

---

## Decision 5 — Adapter-postgres module structure is the `@loop-engine/*` adapter convention

**What the code does.** See Decision 4's file tree. The convention
it establishes:

- `index.ts` is the package's thin public surface. It re-exports
  named symbols from feature modules and contains only the
  code that's intrinsically about the package's main shape (the
  `LoopStore` methods themselves, in this case). No barrel
  `export *`.
- Feature modules sit alongside `index.ts` at the top of `src/`,
  one file per independent concern (`pool.ts`, `errors.ts`).
- Multi-file subsystems get a directory (`migrations/`) with its
  own `runner.ts` entry and any supporting files.
- Tests live in `src/__tests__/` and split per feature
  (`pool.test.ts`, `errors.test.ts`, `transactions.test.ts`,
  `migrations.test.ts`, `indexes.test.ts`, `smoke.test.ts`),
  never in a single monolithic test file.

**Why this matters.** Adapter packages in `@loop-engine/*` share
shape expectations (publish config, peer deps, dual-format,
`sideEffects: false`, provenance). Their *source layout* has been
informal — some packages are single-file, some have ad-hoc splits.
As the family grows toward the "hundreds of adapters planned"
projection in `loop-engine-packaging.md`, a predictable source
layout pays dividends: contributors learn one structure and can
navigate any adapter immediately; tooling (e.g., surface-audit
scripts, docs-site generators) can make layout assumptions.

**Where this lives as a convention.** The shape above is
currently documented here. When a second production-grade adapter
reaches similar complexity (e.g., when `adapter-redis` lands, or
when `adapter-kafka` graduates from `@experimental`) this
convention should be promoted to the family-level
`loop-engine-packaging.md` rule under a "Adapter module layout"
section. Until then this document is the reference; authors of
new `@loop-engine/*` adapters should default to matching this
shape.

**What a future refactor should preserve.** Source reorganizations
that collapse feature modules back into `index.ts`, or that
introduce deep directory hierarchies when a flat `src/*.ts`
suffices, should be evaluated against the three conditions in
Decision 4. Cosmetic churn ("I prefer grouping all types
together") is not sufficient justification.

---

## Decision 6 — `withTransaction` indeterminacy rule: four-way case matrix

**What the code does.** Inside `withTransaction`, the error-handling
path implements an explicit four-way case matrix keyed on "did the
adapter end in a state where the transaction's terminal outcome is
known?":

| Case | Fn promise | Rollback/commit outcome | Adapter action |
|------|------------|-------------------------|----------------|
| A | fulfilled | COMMIT succeeded | return fn's resolved value |
| B | fulfilled | COMMIT failed (non-connection error) | pass `commitErr` through unchanged |
| C | fulfilled | COMMIT failed (connection error) | wrap in `TransactionIntegrityError` |
| D | rejected | ROLLBACK succeeded | pass `fnErr` through unchanged |
| E | rejected | ROLLBACK failed (any reason) | wrap `fnErr` in `TransactionIntegrityError` with `cause: fnErr` |

Case C is the subtlest: a connection error during `COMMIT` means
the command may have succeeded server-side before the connection
dropped (the server committed, but the adapter never received the
acknowledgment). The adapter has no way to confirm whether the
transaction's rows are persisted or rolled back, so the outcome is
indeterminate.

**The governing principle.** *Only wrap an error in
`TransactionIntegrityError` when the adapter genuinely cannot
confirm a definite terminal state.* Every other error — including
every `pg.DatabaseError` from the fn body, every non-connection
COMMIT failure, every constraint violation — passes through
unchanged. The `.kind` discriminant on `PostgresStoreError` and the
`classifyError()` helper give consumers the tool to retry
appropriately; the adapter's job is to not hide information.

**Why the principle matters.** The alternative shape — "wrap
every adapter-originated error in a typed envelope" — sounds more
thorough and is more common in naive adapter designs. It is wrong
for two reasons:

1. **It loses information.** Consumers frequently want to branch
   on the `pg.DatabaseError` code (`23505` for unique violation,
   `23503` for foreign-key violation, etc.) to produce meaningful
   user-facing errors. Wrapping obscures the code behind an
   `.cause` chain and pressures every consumer to unwrap.
2. **It breaks retryability reasoning.** The `kind` discriminant
   is a three-way partition (`"transient"`, `"permanent"`,
   `"unknown"`). When the adapter cannot determine the terminal
   state, no classification is correct — the transaction might
   have succeeded (no retry needed) or failed (retry safe). The
   `TransactionIntegrityError` exists precisely to signal "don't
   assume either; the caller must handle indeterminacy
   explicitly." Applying that label to everything dilutes it.

**What a future refactor must preserve.** Any refactor to the
error-handling path in `withTransaction` must keep the four-way
case matrix as the source of truth for when wrapping applies. A
refactor that, for example, "simplifies" by wrapping all
`commitErr` in `TransactionIntegrityError` (eliminating case B vs
C distinction) is a regression against the governing principle
and should be rejected absent an explicit new decision.

Tests in `src/__tests__/transactions.test.ts` exercise cases B
(non-connection commit failure passes through), C (connection loss
during commit wraps), D (constraint violation in fn body passes
through), and E (rollback failure wraps). Case A is the success
path exercised by nearly every other test.

---

## Cross-references

- `.changeset/1.0.0-rc.0.md` — SR-016 entry records the multi-sub-
  commit scope and rollup-level packages bumped.
- `bd-forge-main/PASS_B_EXECUTION_LOG.md` — SR-016 entry records
  the sub-commit sequence, findings (SF-SR016.3-1, SF-SR016.5-1),
  and verification block.
- `bd-forge-main/.cursor/rules/loop-engine-packaging.md` — the
  pre-publish verification requirements policy derived from
  Decision 1 lives there, not here; this file records the
  specific evidence that motivated the policy.
- `bd-forge-main/PASS_B_CALIBRATION_NOTES.md` — C-14 full-stream
  failure-scan calibration is the verification discipline that
  would have caught SF-SR016.3-1 and SF-SR016.5-1 earlier if the
  integration-test coverage had existed. The two are complementary
  disciplines, not substitutes.

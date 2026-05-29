# @betterdata/canonical-json

Deterministic JSON canonicalization + SHA-256 helpers for tamper-evident
artifacts (baseline manifests, loop-definition hashes, source-data digests).

Apache-2.0 OSS substrate. Depended on by `@betterdata/loop-engine-baselines`
and other governance tooling that needs deterministic byte-for-byte JSON
serialization across machines, runtimes, and time.

## What it does

Two functions:

- `canonicalize(value)` — produce a deterministic string serialization of a
  value. Object keys are sorted lexicographically (UTF-16 code unit order),
  no whitespace, arrays preserve order, numbers/strings/booleans/null
  serialize via the host `JSON.stringify` for the inputs we permit.

- `sha256CanonicalHex(value)` — lowercase hex SHA-256 of the canonical
  serialization. The function tamper-evident artifacts actually call.

A third helper `sha256Hex(input)` exists for callers that have already
pre-canonicalized (e.g., a CSV export hashed as bytes).

## What it deliberately rejects

The implementation is **strict**: it throws `CanonicalizationError` on any
input that cannot be deterministically serialized. Specifically:

- Non-finite numbers (`NaN`, `±Infinity`) — JSON has no representation.
- Integers exceeding `Number.MAX_SAFE_INTEGER` — precision loss on round
  trip. Decimal-precision data must arrive as strings.
- Non-BMP strings with lone surrogates — runtime escaping diverges.
- `undefined`, functions, symbols — no JSON representation at all.

A note on the large-integer case worth surfacing explicitly: any JS number
literal beyond `Number.MAX_SAFE_INTEGER` (`9007199254740991`) is silently
rounded to the nearest IEEE 754 double during evaluation, before
canonicalization ever sees the value. For example, the literal
`9007199254740993` evaluates to `9007199254740992` (banker's rounding to
even). Permissive canonicalizers that delegate to `JSON.stringify` will
hash the rounded value silently, producing a hash that looks valid but
encodes a different number than the caller intended. Canonical-json
rejects such inputs at the canonicalize call so the corruption surfaces
where the bug lives, not days later when a hash-mismatch alert fires.

If a future caller legitimately needs to serialize integers beyond
`MAX_SAFE_INTEGER`, the right move is one of:

- String-wrap the value at the call site (`{ x: "9007199254740993" }`),
  which round-trips losslessly and hashes deterministically.
- Add an explicit `BigInt` handler to canonical-json (a small extension
  to `assertCanonicalizable` + `canonicalSerialize`) — but only if the
  call site has a real need for it. No current caller does.

The error message includes a JSONPath-style location (e.g., `$.outer.inner`)
so authoring bugs surface at the canonicalize call, not days later when a
hash mismatch shows up in production.

This strictness is intentional. Tamper-evident hashing depends on the
serialized form being unambiguous; permissive canonicalizers that silently
turn `NaN` into `null` produce hashes that look valid but encode no
information about the original input. Failing loud is the correct behavior.

## What it doesn't try to be

- Not a full RFC 8785 (JSON Canonicalization Scheme) implementation. The
  subset we support covers everything the loops substrate actually serializes
  (strings, finite numbers within `MAX_SAFE_INTEGER`, booleans, null,
  arrays, objects); we do not implement JCS's number serialization rules
  beyond what `JSON.stringify` produces, which is sufficient for the inputs
  we accept.
- Not a streaming canonicalizer. The whole value must fit in memory.
- Not a schema validator. It validates representability, not semantics.

If a caller needs full RFC 8785 (e.g., to interop with a third-party
verifier in a non-JS runtime), swap in a real JCS library. The interface
(`canonicalize` + `sha256CanonicalHex`) is stable; the body is the only
thing that changes.

## Install

```sh
pnpm add @betterdata/canonical-json
```

Workspace consumers reference it via `workspace:*` in `package.json`.

## Usage

```ts
import { canonicalize, sha256CanonicalHex } from "@betterdata/canonical-json";

const definition = { id: "scm.demand-forecast", version: "1.0.0", states: ["OPEN", "CLOSED"] };

const canonical = canonicalize(definition);
// '{"id":"scm.demand-forecast","states":["OPEN","CLOSED"],"version":"1.0.0"}'

const sha256 = sha256CanonicalHex(definition);
// 'abcdef0123...'  (deterministic across runs and machines)
```

## History

Extracted from `packages/oss/loop-engine-baselines/src/canonical-hash.ts`
to consolidate four near-duplicate inline canonicalizers that had drifted
across the monorepo:

- `packages/internal/dcm-governed-ai/registry/register.ts`
- `packages/internal/dcm-governed-ai/registry/register-gateway-provision.ts`
- `apps/registry-loop/src/services/canonicalization.ts`
- `apps/registry-loop/prisma/seed.ts`

Plus the source-of-truth implementation in `loop-engine-baselines` itself
(which becomes a re-export of this package).

The regression-equivalence harness at
`src/__tests__/regression-equivalence.test.ts` documents what convergence
with the prior implementations was verified against. All four legacy
implementations were functionally identical to each other (`sortRecursively`
+ `JSON.stringify`) and produce byte-identical output to this package's
`canonicalize` for all JSON-safe inputs (which is everything the call sites
actually pass — JSON-parsed data and hand-built object literals).

The legacy implementations differ from this package only in **edge-case
behavior**: they silently produced hashes for inputs that this package
rejects (NaN becomes `"null"`, undefined-valued keys are dropped, etc.).
This package's strict behavior is the correct one for tamper-evidence;
no production call site relied on the permissive behavior.

See `loop-design--02-baseline-lock-infrastructure.md` § "Next-phase PR
sequencing" — this package is the canonicalization-extraction component of
Track 4 PR-A.

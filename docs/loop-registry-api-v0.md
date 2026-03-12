# Loop Registry API v0 (Draft)

This document defines a minimal, implementation-agnostic API contract for a
public Loop Registry at `registry.loopengine.dev`.

It is intentionally scoped as a spec only. No implementation choices are
mandated in this draft.

## Purpose

The Loop Registry exists to publish, discover, and retrieve versioned
`LoopDefinition` artifacts for Loop Engine runtimes.

It answers:

- Which loops exist?
- Which versions are available?
- Which version should a runtime install?
- Is a loop version trusted, deprecated, or withdrawn?

## Boundary and Relationship to Gateway Registry

This API is separate from the Gateway Registry (`registry.betterdata.co`).

- Loop Registry stores **loop definitions** and loop metadata.
- Gateway Registry stores **merchant/gateway routing records**.

Shared substrate is allowed (auth, storage primitives, indexing, observability),
but public APIs and schemas MUST remain separate to avoid domain coupling.

## Design Principles

1. **Read-first v0**: prioritize discovery and install; keep write flows minimal.
2. **Immutable versions**: published loop versions are never mutated in place.
3. **Portable artifacts**: registry payloads are runtime-agnostic.
4. **Verifiable integrity**: artifacts include hashes/signatures.
5. **Clear lifecycle states**: active, deprecated, withdrawn.

## API Conventions

- Base URL: `https://registry.loopengine.dev`
- Versioning: path version (`/v0/...`)
- Content type: `application/json`
- Time format: RFC 3339 UTC
- IDs:
  - `loopId`: stable logical ID, e.g. `finance.invoice-collection`
  - `version`: SemVer, e.g. `1.2.0`
- Pagination:
  - Request: `limit` (default 20, max 100), `cursor`
  - Response: `nextCursor`

## Resource Model

### LoopSummary

```json
{
  "id": "finance.invoice-collection",
  "latestVersion": "1.2.0",
  "latestStableVersion": "1.1.3",
  "domain": "finance",
  "title": "Invoice Collection",
  "description": "Collect invoices with guard-backed escalation.",
  "tags": ["finance", "collections", "accounts-receivable"],
  "maintainers": ["loopengine-core"],
  "status": "active",
  "publishedAt": "2026-03-10T12:00:00Z"
}
```

### LoopVersionSummary

```json
{
  "id": "finance.invoice-collection",
  "version": "1.2.0",
  "stability": "stable",
  "status": "active",
  "breakingFrom": "1.1.3",
  "publishedAt": "2026-03-10T12:00:00Z",
  "deprecatedAt": null,
  "withdrawnAt": null,
  "integrity": {
    "sha256": "2f6e0a...",
    "signature": "base64-signature",
    "signatureKeyId": "loop-registry-2026-k1"
  }
}
```

### LoopArtifact

```json
{
  "id": "finance.invoice-collection",
  "version": "1.2.0",
  "definition": {
    "id": "finance.invoice-collection",
    "version": "1.2.0",
    "domain": "finance"
  },
  "manifest": {
    "title": "Invoice Collection",
    "description": "Collect invoices with guard-backed escalation.",
    "tags": ["finance", "collections"],
    "compatibility": {
      "minSdk": "0.1.0",
      "minRuntime": "0.1.0"
    }
  },
  "integrity": {
    "sha256": "2f6e0a...",
    "signature": "base64-signature",
    "signatureKeyId": "loop-registry-2026-k1"
  },
  "publishedAt": "2026-03-10T12:00:00Z"
}
```

## Public Read API (v0)

### `GET /v0/health`

Readiness/liveness.

Response:

```json
{
  "status": "ok",
  "time": "2026-03-10T12:00:00Z",
  "version": "v0"
}
```

### `GET /v0/loops`

List loops.

Query params:

- `domain` (optional)
- `tag` (optional, repeatable)
- `q` (optional, text search over id/title/description)
- `status` (optional: `active|deprecated|withdrawn`)
- `limit`, `cursor`

Response:

```json
{
  "results": [],
  "nextCursor": null
}
```

### `GET /v0/loops/{loopId}`

Get loop summary and recommended install target.

Query params:

- `channel` (optional: `stable|latest`, default `stable`)

Response:

```json
{
  "loop": {},
  "recommendedVersion": "1.1.3"
}
```

### `GET /v0/loops/{loopId}/versions`

List all versions for a loop (newest first).

Query params:

- `stability` (optional: `stable|rc|beta|alpha`)
- `status` (optional)
- `limit`, `cursor`

Response:

```json
{
  "results": [],
  "nextCursor": null
}
```

### `GET /v0/loops/{loopId}/versions/{version}`

Retrieve a full loop artifact for installation.

Response: `LoopArtifact`

### `POST /v0/resolve`

Resolve install target from policy-like request.

Request:

```json
{
  "id": "finance.invoice-collection",
  "constraint": "^1.1.0",
  "channel": "stable"
}
```

Response:

```json
{
  "id": "finance.invoice-collection",
  "resolvedVersion": "1.1.3"
}
```

## Publisher API (Minimal v0)

Publisher flows are authenticated and intended for maintainers/automation only.

### `POST /v0/publisher/loops/{loopId}/versions`

Publish a new immutable loop artifact.

Request body:

- `version` (SemVer, required)
- `definition` (`LoopDefinition`, required)
- `manifest` (required)
- `integrity.sha256` (required)
- `integrity.signature` (optional in v0, recommended)

Behavior:

- Reject if `{loopId, version}` already exists.
- Validate `definition.id == loopId` and `definition.version == version`.
- Validate against current Loop Definition schema.

### `POST /v0/publisher/loops/{loopId}/versions/{version}/deprecate`

Mark version deprecated with message and replacement hint.

### `POST /v0/publisher/loops/{loopId}/versions/{version}/withdraw`

Mark version withdrawn (remains discoverable, not installable by default).

## Status and Lifecycle

Version status:

- `active`: installable and visible
- `deprecated`: installable with warning
- `withdrawn`: not installable unless explicit override

Loop status is derived from version set:

- `active` if at least one active/deprecated version exists
- `withdrawn` if all versions withdrawn

## Integrity and Trust (v0 minimum)

- Every artifact includes `sha256` over canonical JSON payload.
- Registry returns a stable canonicalization strategy for hashing.
- Signature support is optional in v0 but should be first upgrade candidate.
- Clients SHOULD verify `sha256` before install.

## Error Model

All non-2xx responses use:

```json
{
  "error": {
    "code": "LOOP_NOT_FOUND",
    "message": "Loop finance.invoice-collection not found",
    "details": {}
  }
}
```

Initial error codes:

- `INVALID_REQUEST`
- `LOOP_NOT_FOUND`
- `VERSION_NOT_FOUND`
- `VERSION_ALREADY_EXISTS`
- `INVALID_LOOP_DEFINITION`
- `INTEGRITY_MISMATCH`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## Compatibility and Versioning Rules

### API Versioning

- Breaking API changes require a new path version (`/v1`).
- Additive fields/endpoints are allowed in `v0`.

### Loop Artifact Versioning

- Loop versions MUST follow SemVer.
- Published versions are immutable.
- Breaking loop-definition schema changes require:
  - schema version bump in `manifest`,
  - migration guidance,
  - deprecation window for previous schema.

### Recommendation Policy

Default install behavior for clients:

- `channel=stable`
- highest non-withdrawn version satisfying constraint
- never auto-upgrade across major unless explicitly allowed

## Suggested JSON Schemas (v0)

The first schema bundle should include:

- `LoopSummary.schema.json`
- `LoopVersionSummary.schema.json`
- `LoopArtifact.schema.json`
- `ResolveRequest.schema.json`
- `Error.schema.json`

These schemas SHOULD be published with semver and referenced in API docs.

## Out of Scope for v0

- Multi-registry federation between third-party Loop Registries
- Package signing PKI policy beyond basic signature field support
- Complex RBAC model for publishers
- Billing, quotas, or tenant-level entitlements
- Runtime execution metadata (belongs to observability systems, not registry)

## Migration Notes (Future)

Likely `v1` additions:

- signed provenance attestations (SLSA/in-toto style)
- SBOM attachment per artifact
- policy packs for org-level install controls
- registry webhooks (new version published, deprecated, withdrawn)

---

This draft is intentionally minimal to align teams on contract shape before
implementation scope is chosen.

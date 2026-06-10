# Loop Registry API v0

Base URL: `https://registry.loopengine.dev`

Versioning strategy:

- API path versioning (`/v0`)
- Additive changes allowed in v0
- Breaking changes require `/v1`

Core resources:

- `LoopSummary`
- `LoopVersionSummary`
- `LoopArtifact`

Error envelope:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Valid error codes:

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

Endpoints:

- `GET /v0/health`
- `GET /v0/loops`
- `GET /v0/loops/{loopId}`
- `GET /v0/loops/{loopId}/versions`
- `GET /v0/loops/{loopId}/versions/{version}`
- `POST /v0/resolve`
- `POST /v0/publisher/loops/{loopId}/versions`
- `POST /v0/publisher/loops/{loopId}/versions/{version}/deprecate`
- `POST /v0/publisher/loops/{loopId}/versions/{version}/withdraw`
- `GET /v0/schemas/canonicalization`

Integrity:

- Canonicalize definition JSON by recursively sorting keys.
- Serialize as compact UTF-8 JSON.
- Compute SHA-256 over canonical JSON.

Rate limits:

- Public read: `100/min` per IP
- Resolve: `60/min` per IP
- Publisher writes: `20/min` per bearer token

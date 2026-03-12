# HTTP API Contract

The `httpRegistry()` adapter expects a server that implements these endpoints.

## GET `/loops`

List all loop definitions.

### Query parameters

- `domain` (optional): filter by `LoopDefinition.domain`

### Response

- `200 OK` with `LoopDefinition[]`

### Status codes

- `200` success
- `5xx` server error

## GET `/loops?domain={domain}`

List loop definitions filtered by domain.

### Response

- `200 OK` with `LoopDefinition[]`

### Status codes

- `200` success
- `5xx` server error

## GET `/loops/{loopId}`

Fetch loop definition by ID.

### Response

- `200 OK` with `LoopDefinition`

### Status codes

- `200` success
- `404` not found
- `5xx` server error

## GET `/loops/{loopId}/{version}`

Fetch specific loop definition version.

### Response

- `200 OK` with `LoopDefinition`

### Status codes

- `200` success
- `404` not found
- `5xx` server error

## POST `/loops`

Register a loop definition.

### Query parameters

- `force` (optional, boolean): overwrite existing loop/version when `true`

### Request body

- JSON `LoopDefinition`

### Response

- `201 Created`

### Status codes

- `201` created
- `400` invalid payload
- `409` conflict (`id@version` exists and no force)
- `5xx` server error

## DELETE `/loops/{loopId}`

Remove loop definition by ID.

### Response

- `204 No Content`

### Status codes

- `204` removed
- `404` not found
- `5xx` server error

## Reference server implementation

See [`packages/registry-client/examples/server.ts`](https://github.com/loopengine/loop-engine/blob/main/packages/registry-client/examples/server.ts) for a minimal implementation of this contract.

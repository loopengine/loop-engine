// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * Canonical error envelope mandated by `docs/internal/contracts/runtime-api-contract-v1.md`:
 *   - `{ "error": string }` always.
 *   - Optional `{ "fields": Record<string,string> }` for 422 validation details.
 *
 * Implemented as plain `Response` objects (Web standard) so the same factories
 * work in any runtime-agnostic call site — including `runtime-routes` tests that
 * don't load Next.js.
 */
export type ErrorBody = {
  error: string;
  fields?: Record<string, string>;
};

const JSON_HEADERS: Record<string, string> = { "Content-Type": "application/json" };

function jsonError(
  status: number,
  error: string,
  fields?: Record<string, string>,
  headers?: Record<string, string>,
): Response {
  const body: ErrorBody = fields ? { error, fields } : { error };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(headers ?? {}) },
  });
}

export function err401(message = "Unauthorized"): Response {
  return jsonError(401, message);
}

export function err403(message = "Forbidden"): Response {
  return jsonError(403, message);
}

export function err404(message = "Not Found"): Response {
  return jsonError(404, message);
}

export function err409(message = "Conflict"): Response {
  return jsonError(409, message);
}

export function err422(message: string, fields?: Record<string, string>): Response {
  return jsonError(422, message, fields);
}

export function err429(message = "Too Many Requests"): Response {
  return jsonError(429, message, undefined, { "Retry-After": "60" });
}

export function err500(message = "Internal Server Error"): Response {
  return jsonError(500, message);
}

export function err503(message = "Service Unavailable"): Response {
  return jsonError(503, message, undefined, { "Retry-After": "30" });
}

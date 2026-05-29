// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * Strips the `Bearer ` scheme prefix off an Authorization header value.
 * Returns `null` for missing / malformed / non-Bearer headers; otherwise returns
 * the trimmed token.
 *
 * Mirrors the long-standing helper in `@repo/auth/api-keys/bearer` so OSS
 * deployments don't need to vendor a proprietary auth package.
 */
export function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  const trimmed = token.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Convenience that pulls the Authorization header off a Web `Request` and runs
 * `extractBearerToken` on it.
 */
export function extractBearerTokenFromRequest(request: Request): string | null {
  return extractBearerToken(request.headers.get("authorization"));
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import {
  buildMetadataConnectionsResponse,
  err422,
  parseRuntimeConnectionCategory,
} from "@loop-engine/runtime-core";

/**
 * Web-standard handler signature — works as a Next.js Route Handler when
 * re-exported as `GET`.
 */
export type MetadataConnectionsHandler = (request: Request) => Promise<Response>;

/**
 * RT-11 metadata catalog handler.
 *
 * The catalog is static (no DB lookups, no per-tenant filtering) so this
 * route doesn't need auth/entitlements. Validates `?category=` and returns
 * 422 with the contract envelope when invalid.
 */
export function createMetadataConnectionsHandler(): MetadataConnectionsHandler {
  return async (request) => {
    const url = new URL(request.url);
    const categoryParam = url.searchParams.get("category");
    const category = parseRuntimeConnectionCategory(categoryParam);
    if (category === "invalid") {
      return err422("Invalid query parameter", {
        category: "Must be one of: provider, channel, integration, protocol",
      });
    }
    return Response.json(buildMetadataConnectionsResponse(category));
  };
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { RUNTIME_API_CONTRACT_VERSION } from "@loop-engine/observability";

import { getRuntimeConnectionCatalog, listRuntimeConnections } from "./catalog.js";
import type { MetadataConnectionsResponse, RuntimeConnectionCategory } from "./types.js";

export function buildMetadataConnectionsResponse(
  category?: RuntimeConnectionCategory | null,
): MetadataConnectionsResponse {
  const { catalogVersion } = getRuntimeConnectionCatalog();
  return {
    contractVersion: RUNTIME_API_CONTRACT_VERSION,
    catalogVersion,
    connections: listRuntimeConnections(category),
  };
}

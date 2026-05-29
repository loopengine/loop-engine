// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import catalogData from "../../schemas/runtime-connections.json" with { type: "json" };

import {
  RUNTIME_CONNECTION_CATEGORIES,
  type RuntimeConnection,
  type RuntimeConnectionCatalog,
  type RuntimeConnectionCategory,
} from "./types.js";

const catalog = catalogData as RuntimeConnectionCatalog;

/** Returns the bundled RuntimeConnection catalog (mirrors hosted-loops). */
export function getRuntimeConnectionCatalog(): RuntimeConnectionCatalog {
  return catalog;
}

/**
 * Filter the catalog by category. Passing `null` / `undefined` returns the full
 * catalog (defensive copy).
 */
export function listRuntimeConnections(
  category?: RuntimeConnectionCategory | null,
): RuntimeConnection[] {
  const connections = catalog.connections;
  if (!category) {
    return [...connections];
  }
  return connections.filter((connection) => connection.category === category);
}

export function isRuntimeConnectionCategory(value: string): value is RuntimeConnectionCategory {
  return (RUNTIME_CONNECTION_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Parse the `?category=` query parameter. Returns the normalized category, or
 * `null` when the parameter is absent, or the sentinel `"invalid"` so the
 * caller can map it to HTTP 422.
 */
export function parseRuntimeConnectionCategory(
  value: string | null,
): RuntimeConnectionCategory | null | "invalid" {
  if (value === null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  return isRuntimeConnectionCategory(normalized) ? normalized : "invalid";
}

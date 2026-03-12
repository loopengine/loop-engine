// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopRegistry } from "../types";
import { httpRegistry } from "./http";

export interface BetterDataRegistryOptions {
  /**
   * Better Data API key.
   * Required. Obtain from betterdata.co/settings/api-keys.
   */
  apiKey: string;

  /**
   * Tenant / org ID in the Better Data platform.
   * Required for tenant-scoped operations.
   */
  orgId: string;

  /**
   * Registry environment. Default: 'production'.
   * Use 'staging' for pre-release testing.
   */
  env?: "production" | "staging";

  /**
   * Cache TTL in milliseconds. Default: 300_000 (5 minutes).
   * Longer default than httpRegistry because BD registry is stable.
   */
  cacheTtlMs?: number;
}

export function betterDataRegistry(
  options: BetterDataRegistryOptions
): LoopRegistry {
  const env = options.env ?? "production";
  const baseUrl =
    env === "staging"
      ? "https://registry-staging.betterdata.co/loops"
      : "https://registry.betterdata.co/loops";

  return httpRegistry({
    baseUrl,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "X-BD-Org-Id": options.orgId,
      "X-BD-Client": "@loop-engine/registry-client"
    },
    cacheTtlMs: options.cacheTtlMs ?? 300_000,
    timeoutMs: 15_000,
    retries: 3
  });
}

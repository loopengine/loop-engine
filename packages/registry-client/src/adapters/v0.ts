// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition, LoopId } from "@loop-engine/core";
import { LoopDefinitionSchema } from "@loop-engine/core";
import { applyAuthoringDefaults, validateLoopDefinition } from "@loop-engine/loop-definition";
import type { LoopRegistry, LoopRegistryOptions } from "../types";
import { RegistryNetworkError } from "../types";

export type V0RegistryChannel = "stable" | "latest";

export interface V0RegistryOptions extends LoopRegistryOptions {
  /**
   * Registry origin only (no path suffix).
   * Example: `https://registry.loopengine.dev` or `http://localhost:3011`
   */
  baseUrl: string;

  /**
   * Channel for `GET /v0/loops/{loopId}?channel=` and list version selection.
   * @default "stable"
   */
  channel?: V0RegistryChannel;

  /** Optional headers (Authorization, tenant, etc.). */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds. @default 10_000 */
  timeoutMs?: number;

  /** Retries on network failure and 5xx. @default 2 */
  retries?: number;
}

interface V0ListResponse {
  results: V0LoopSummary[];
  nextCursor: string | null;
}

interface V0LoopSummary {
  id: string;
  latestVersion: string | null;
  latestStableVersion: string | null;
  domain: string;
}

interface V0LoopChannelResponse {
  loop: V0LoopSummary;
  recommendedVersion: string | null;
}

interface V0LoopArtifact {
  id: string;
  version: string;
  definition: unknown;
}

type CacheEntry = {
  data: LoopDefinition[];
  expiresAt: number;
};

function normalizeOrigin(baseUrl: string): string {
  let base = baseUrl.replace(/\/$/, "");
  base = base.replace(/\/v0(\/.*)?$/, "");
  base = base.replace(/\/loops$/, "");
  return base;
}

function loopsRoot(origin: string): string {
  return `${normalizeOrigin(origin)}/v0/loops`;
}

function parseLoopDefinition(input: unknown): LoopDefinition {
  const definition = applyAuthoringDefaults(LoopDefinitionSchema.parse(input));
  const validated = validateLoopDefinition(definition);
  if (!validated.valid) {
    throw new Error(
      `Invalid loop definition from registry: ${validated.errors.map((error) => `${error.code}: ${error.message}`).join("; ")}`
    );
  }
  return definition;
}

function pickListVersion(summary: V0LoopSummary, channel: V0RegistryChannel): string | null {
  if (channel === "stable") {
    return summary.latestStableVersion ?? summary.latestVersion;
  }
  return summary.latestVersion ?? summary.latestStableVersion;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Canonical registry client for [registry-loop v0](https://github.com/loopengine/loop-engine/blob/main/docs/specs/loop-registry-api-v0.md).
 *
 * Implements {@link LoopRegistry} against:
 * - `GET /v0/loops`
 * - `GET /v0/loops/{loopId}?channel=`
 * - `GET /v0/loops/{loopId}/versions/{version}`
 *
 * Publisher writes (`POST /v0/publisher/...`) are not exposed on this interface.
 */
export function v0Registry(options: V0RegistryOptions): LoopRegistry {
  const root = loopsRoot(options.baseUrl);
  const channel: V0RegistryChannel = options.channel ?? "stable";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const listCache = new Map<string, CacheEntry>();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  const fetchWithRetry = async (url: string, init: RequestInit): Promise<Response> => {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
        clearTimeout(timeout);

        if (response.status >= 500) {
          if (attempt < retries) {
            await sleep(200 * 2 ** attempt);
            attempt += 1;
            continue;
          }
          throw new RegistryNetworkError(url, response.status);
        }
        return response;
      } catch (error) {
        clearTimeout(timeout);
        const wrapped =
          error instanceof RegistryNetworkError
            ? error
            : new RegistryNetworkError(url, undefined, error instanceof Error ? error : undefined);
        lastError = wrapped;
        if (attempt < retries) {
          await sleep(200 * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw wrapped;
      }
    }

    throw lastError ?? new RegistryNetworkError(options.baseUrl);
  };

  const fetchArtifact = async (loopId: string, version: string): Promise<LoopDefinition | null> => {
    const url = `${root}/${encodeURIComponent(loopId)}/versions/${encodeURIComponent(version)}`;
    const response = await fetchWithRetry(url, { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) throw new RegistryNetworkError(url, response.status);
    const raw = (await response.json()) as V0LoopArtifact;
    return parseLoopDefinition(raw.definition);
  };

  return {
    async get(id: LoopId): Promise<LoopDefinition | null> {
      const loopId = String(id);
      const summaryUrl = `${root}/${encodeURIComponent(loopId)}?channel=${encodeURIComponent(channel)}`;
      const response = await fetchWithRetry(summaryUrl, { method: "GET" });
      if (response.status === 404) return null;
      if (!response.ok) throw new RegistryNetworkError(summaryUrl, response.status);

      const body = (await response.json()) as V0LoopChannelResponse;
      const version =
        body.recommendedVersion ??
        pickListVersion(body.loop, channel);
      if (!version) return null;
      return fetchArtifact(loopId, version);
    },

    async getVersion(id: LoopId, version: string): Promise<LoopDefinition | null> {
      return fetchArtifact(String(id), version);
    },

    async list(listOptions?: { domain?: string }): Promise<LoopDefinition[]> {
      const key = JSON.stringify({ channel, domain: listOptions?.domain ?? null });
      const now = Date.now();
      if (cacheTtlMs > 0) {
        const cached = listCache.get(key);
        if (cached && cached.expiresAt > now) {
          return cached.data;
        }
      }

      const definitions: LoopDefinition[] = [];
      let cursor: string | null = null;

      do {
        const url = new URL(root);
        url.searchParams.set("limit", "100");
        if (listOptions?.domain) {
          url.searchParams.set("domain", listOptions.domain);
        }
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const response = await fetchWithRetry(url.toString(), { method: "GET" });
        if (!response.ok) throw new RegistryNetworkError(url.toString(), response.status);

        const list = (await response.json()) as V0ListResponse;
        if (!Array.isArray(list.results)) {
          throw new RegistryNetworkError(url.toString(), response.status);
        }

        for (const summary of list.results) {
          const version = pickListVersion(summary, channel);
          if (!version) continue;
          const definition = await fetchArtifact(summary.id, version);
          if (definition) {
            definitions.push(definition);
          }
        }

        cursor = typeof list.nextCursor === "string" ? list.nextCursor : null;
      } while (cursor);

      if (cacheTtlMs > 0) {
        listCache.set(key, { data: definitions, expiresAt: now + cacheTtlMs });
      }
      return definitions;
    },

    async has(id: LoopId): Promise<boolean> {
      const found = await this.get(id);
      return found !== null;
    },

    async register(_definition: LoopDefinition, _registerOptions?: { force?: boolean }): Promise<void> {
      throw new Error(
        "v0Registry does not support register(); use registry-loop POST /v0/publisher/loops/{loopId}/versions"
      );
    },

    async remove(_id: LoopId): Promise<boolean> {
      return false;
    },
  };
}

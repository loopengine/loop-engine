// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition, LoopId } from "@loop-engine/core";
import { LoopDefinitionSchema } from "@loop-engine/core";
import { applyAuthoringDefaults, validateLoopDefinition } from "@loop-engine/loop-definition";
import type { LoopRegistry, LoopRegistryOptions } from "../types";
import { RegistryConflictError, RegistryNetworkError } from "../types";

export interface HttpRegistryOptions extends LoopRegistryOptions {
  /**
   * Base URL of the registry server.
   * Example: 'https://registry.loopengine.dev'
   * Example: 'http://localhost:3001'
   */
  baseUrl: string;

  /**
   * Optional headers sent with every request.
   * Use for Authorization, API keys, tenant headers, etc.
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds. Default: 10_000.
   */
  timeoutMs?: number;

  /**
   * Number of retries on network failure (not on 4xx). Default: 2.
   */
  retries?: number;
}

type CacheEntry = {
  data: LoopDefinition[];
  expiresAt: number;
};

function normalizeRoot(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return base.endsWith("/loops") ? base : `${base}/loops`;
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function httpRegistry(options: HttpRegistryOptions): LoopRegistry {
  const baseRoot = normalizeRoot(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const listCache = new Map<string, CacheEntry>();

  const headers = {
    ...(options.headers ?? {})
  };

  const fetchWithRetry = async (url: string, init: RequestInit): Promise<Response> => {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
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

  const getFromListCache = (id: LoopId): LoopDefinition | null => {
    const now = Date.now();
    for (const entry of listCache.values()) {
      if (entry.expiresAt <= now) continue;
      const found = entry.data.find((definition) => definition.id === id);
      if (found) return found;
    }
    return null;
  };

  return {
    async get(id: LoopId): Promise<LoopDefinition | null> {
      if (cacheTtlMs > 0) {
        const cached = getFromListCache(id);
        if (cached) return cached;
      }

      const url = `${baseRoot}/${encodeURIComponent(String(id))}`;
      const response = await fetchWithRetry(url, { method: "GET", headers });
      if (response.status === 404) return null;
      if (!response.ok) throw new RegistryNetworkError(url, response.status);
      return parseLoopDefinition(await response.json());
    },

    async getVersion(id: LoopId, version: string): Promise<LoopDefinition | null> {
      const url = `${baseRoot}/${encodeURIComponent(String(id))}/${encodeURIComponent(version)}`;
      const response = await fetchWithRetry(url, { method: "GET", headers });
      if (response.status === 404) return null;
      if (!response.ok) throw new RegistryNetworkError(url, response.status);
      return parseLoopDefinition(await response.json());
    },

    async list(listOptions?: { domain?: string }): Promise<LoopDefinition[]> {
      const key = JSON.stringify(listOptions ?? {});
      const now = Date.now();
      if (cacheTtlMs > 0) {
        const cached = listCache.get(key);
        if (cached && cached.expiresAt > now) {
          return cached.data;
        }
      }

      const params = new URLSearchParams();
      if (listOptions?.domain) {
        params.set("domain", listOptions.domain);
      }
      const url = `${baseRoot}${params.size > 0 ? `?${params.toString()}` : ""}`;
      const response = await fetchWithRetry(url, { method: "GET", headers });
      if (!response.ok) throw new RegistryNetworkError(url, response.status);
      const parsed = await response.json();
      if (!Array.isArray(parsed)) {
        throw new RegistryNetworkError(url, response.status);
      }
      const definitions = parsed.map(parseLoopDefinition);
      if (cacheTtlMs > 0) {
        listCache.set(key, { data: definitions, expiresAt: now + cacheTtlMs });
      }
      return definitions;
    },

    async has(id: LoopId): Promise<boolean> {
      const found = await this.get(id);
      return found !== null;
    },

    async register(definition: LoopDefinition, registerOptions?: { force?: boolean }): Promise<void> {
      const params = new URLSearchParams();
      if (registerOptions?.force) {
        params.set("force", "true");
      }
      const url = `${baseRoot}${params.size > 0 ? `?${params.toString()}` : ""}`;
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers
        },
        body: JSON.stringify(definition)
      });
      if (response.status === 409) {
        throw new RegistryConflictError(definition.id, definition.version);
      }
      if (response.status !== 201) {
        throw new RegistryNetworkError(url, response.status);
      }
      options.onChange?.({ type: "registered", definition });
      listCache.clear();
    },

    async remove(id: LoopId): Promise<boolean> {
      const url = `${baseRoot}/${encodeURIComponent(String(id))}`;
      const response = await fetchWithRetry(url, { method: "DELETE", headers });
      if (response.status === 404) return false;
      if (response.status !== 204) throw new RegistryNetworkError(url, response.status);
      options.onChange?.({ type: "removed", loopId: id });
      listCache.clear();
      return true;
    }
  };
}

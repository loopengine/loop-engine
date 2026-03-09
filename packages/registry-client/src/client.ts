// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopDefinition } from "@loopengine/core";
import { validateLoopDefinition } from "@loopengine/dsl";
import type {
  LoopRegistryClientOptions,
  RegistryClientLike,
  RegistrySearchQuery,
  RegistrySearchResult,
  LoopRegistryEntry
} from "./types";

async function fetchJson(url: string, init: RequestInit, timeout: number): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } finally {
    clearTimeout(id);
  }
}

export class LoopRegistryClient implements RegistryClientLike {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly apiKey: string | undefined;

  constructor(options: LoopRegistryClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeout = options.timeout ?? 10_000;
    this.apiKey = options.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
    };
  }

  async search(query?: RegistrySearchQuery): Promise<RegistrySearchResult> {
    const params = new URLSearchParams();
    if (query?.domain) params.set("domain", query.domain);
    if (query?.q) params.set("q", query.q);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    query?.tags?.forEach((t) => params.append("tags", t));
    const url = `${this.baseUrl}/loops${params.toString() ? `?${params}` : ""}`;
    return (await fetchJson(url, { headers: this.headers() }, this.timeout)) as RegistrySearchResult;
  }

  async get(loopId: string, version?: string): Promise<LoopDefinition | null> {
    const params = new URLSearchParams();
    if (version) params.set("version", version);
    const url = `${this.baseUrl}/loops/${encodeURIComponent(loopId)}${params.toString() ? `?${params}` : ""}`;
    try {
      const data = await fetchJson(url, { headers: this.headers() }, this.timeout);
      const validated = validateLoopDefinition(data);
      if (!validated.valid) {
        throw new Error(`Invalid loop definition from registry: ${validated.errors.join("; ")}`);
      }
      return validated.definition as LoopDefinition;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  async install(loopId: string, version?: string): Promise<{
    definition: LoopDefinition;
    installedVersion: string;
  }> {
    const definition = await this.get(loopId, version);
    if (!definition) {
      throw new Error(`Loop not found: ${loopId}`);
    }
    return { definition, installedVersion: definition.version };
  }

  async listInstalled(orgId: string): Promise<LoopRegistryEntry[]> {
    const url = `${this.baseUrl}/installed?orgId=${encodeURIComponent(orgId)}`;
    return (await fetchJson(url, { headers: this.headers() }, this.timeout)) as LoopRegistryEntry[];
  }
}

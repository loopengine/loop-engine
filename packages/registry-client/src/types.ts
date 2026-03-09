// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopDefinition, LoopId } from "@loop-engine/core";

export interface LoopRegistryClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface LoopRegistryEntry {
  id: LoopId;
  version: string;
  domain: string;
  description: string;
  tags: string[];
  publishedBy: string;
  publishedAt: string;
}

export interface RegistrySearchQuery {
  domain?: string;
  tags?: string[];
  q?: string;
  page?: number;
  limit?: number;
}

export interface RegistrySearchResult {
  results: LoopRegistryEntry[];
  total: number;
  page: number;
}

export interface RegistryClientLike {
  search(query?: RegistrySearchQuery): Promise<RegistrySearchResult>;
  get(loopId: string, version?: string): Promise<LoopDefinition | null>;
  install(loopId: string, version?: string): Promise<{
    definition: LoopDefinition;
    installedVersion: string;
  }>;
  listInstalled(orgId: string): Promise<LoopRegistryEntry[]>;
}

// @license MIT
// SPDX-License-Identifier: MIT
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { LoopDefinition } from "@loopengine/core";
import { parseLoopYaml } from "@loopengine/dsl";
import type { LoopRegistryEntry, RegistryClientLike, RegistrySearchQuery, RegistrySearchResult } from "./types";

class LocalRegistryClient implements RegistryClientLike {
  constructor(private readonly loopsDir: string, private readonly loops: LoopDefinition[]) {}

  async search(query?: RegistrySearchQuery): Promise<RegistrySearchResult> {
    const filtered = this.loops.filter((loop) => {
      if (query?.domain && loop.domain !== query.domain) return false;
      if (query?.q && !`${loop.id} ${loop.description}`.toLowerCase().includes(query.q.toLowerCase())) {
        return false;
      }
      return true;
    });
    const results: LoopRegistryEntry[] = filtered.map((loop) => ({
      id: loop.id,
      version: loop.version,
      domain: loop.domain,
      description: loop.description,
      tags: [loop.domain],
      publishedBy: "local",
      publishedAt: new Date().toISOString()
    }));
    return { results, total: results.length, page: query?.page ?? 1 };
  }

  async get(loopId: string): Promise<LoopDefinition | null> {
    return this.loops.find((loop) => loop.id === loopId) ?? null;
  }

  async install(loopId: string): Promise<{ definition: LoopDefinition; installedVersion: string }> {
    const loop = await this.get(loopId);
    if (!loop) throw new Error(`Loop not found: ${loopId}`);
    return { definition: loop, installedVersion: loop.version };
  }

  async listInstalled(): Promise<LoopRegistryEntry[]> {
    return this.loops.map((loop) => ({
      id: loop.id,
      version: loop.version,
      domain: loop.domain,
      description: loop.description,
      tags: [loop.domain],
      publishedBy: "local",
      publishedAt: new Date().toISOString()
    }));
  }
}

export async function createLocalRegistry(loopsDir: string): Promise<RegistryClientLike> {
  const files = await readdir(loopsDir);
  const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const loops: LoopDefinition[] = [];
  for (const file of yamlFiles) {
    const content = await readFile(path.join(loopsDir, file), "utf8");
    loops.push(parseLoopYaml(content));
  }
  return new LocalRegistryClient(loopsDir, loops);
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition, LoopId } from "@loop-engine/core";
import { parseLoopJson, parseLoopYaml, validateLoopDefinition } from "@loop-engine/dsl";
import type { LoopRegistry, LoopRegistryOptions, RegistryEntry } from "../types";
import { RegistryConflictError } from "../types";


export interface LocalRegistryOptions extends LoopRegistryOptions {
  /**
   * Initial loop definitions to register immediately.
   * Works in all environments including browser.
   */
  definitions?: LoopDefinition[];

  /**
   * Filesystem path to a directory of .yaml or .json loop definition files.
   * Node.js only. Ignored in browser environments.
   * Files are loaded eagerly on first list() or get() call.
   */
  loopsDir?: string;

  /**
   * Watch loopsDir for changes and auto-reload.
   * Node.js only. Default: false.
   * Only effective when loopsDir is provided.
   */
  watch?: boolean;
}

function normalizeOptions(options?: LoopDefinition[] | LocalRegistryOptions): LocalRegistryOptions {
  if (!options) return {};
  if (Array.isArray(options)) {
    return { definitions: options };
  }
  return options;
}

async function toHex(bytes: Uint8Array): Promise<string> {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checksum(definition: LoopDefinition): Promise<string> {
  const raw = JSON.stringify(definition);
  const text = new TextEncoder().encode(raw);

  // Web Crypto path (browser + modern Node)
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", text);
    return toHex(new Uint8Array(hashBuffer));
  }

  // Node fallback path
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function toLoopId(id: string): LoopId {
  return id as LoopId;
}

export function localRegistry(options?: LoopDefinition[] | LocalRegistryOptions): LoopRegistry {
  const resolved = normalizeOptions(options);
  const entries = new Map<LoopId, RegistryEntry>();
  let loaded = false;
  let watcherStarted = false;

  const isBrowser = typeof globalThis !== "undefined" && "window" in globalThis;
  if (resolved.loopsDir && isBrowser) {
    console.warn(
      "localRegistry: loopsDir is not supported in browser environments. Use definitions[] instead."
    );
  }

  const upsert = async (
    definition: LoopDefinition,
    source: RegistryEntry["source"],
    force = false
  ): Promise<void> => {
    const loopId = definition.id;
    const existing = entries.get(loopId);
    if (existing) {
      if (existing.definition.version === definition.version && !force) {
        throw new RegistryConflictError(loopId, definition.version);
      }
      entries.set(loopId, {
        definition,
        registeredAt: new Date().toISOString(),
        source,
        checksum: await checksum(definition)
      });
      resolved.onChange?.({ type: "updated", definition });
      return;
    }

    entries.set(loopId, {
      definition,
      registeredAt: new Date().toISOString(),
      source,
      checksum: await checksum(definition)
    });
    resolved.onChange?.({ type: "registered", definition });
  };

  const parseFileContent = (fileName: string, content: string): LoopDefinition | null => {
    if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
      return parseLoopYaml(content);
    }
    if (fileName.endsWith(".json")) {
      const definition = parseLoopJson(content);
      const validated = validateLoopDefinition(definition);
      if (!validated.valid || !validated.definition) {
        throw new Error(validated.errors.join("; "));
      }
      return validated.definition;
    }
    return null;
  };

  const loadFromDirectory = async (): Promise<void> => {
    if (!resolved.loopsDir || isBrowser) return;
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = fs.readdirSync(resolved.loopsDir);
    for (const file of files) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml") && !file.endsWith(".json")) continue;
      const fullPath = path.join(resolved.loopsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const definition = parseFileContent(file, content);
      if (!definition) continue;
      await upsert(definition, "local", true);
    }
  };

  const startWatcher = async (): Promise<void> => {
    if (watcherStarted || !resolved.watch || !resolved.loopsDir || isBrowser) return;
    watcherStarted = true;

    const fs = await import("node:fs");
    const path = await import("node:path");
    fs.watch(resolved.loopsDir, async (_event, fileName) => {
      if (!fileName) return;
      if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml") && !fileName.endsWith(".json")) return;
      const fullPath = path.join(resolved.loopsDir as string, fileName);
      try {
        if (!fs.existsSync(fullPath)) {
          return;
        }
        const content = fs.readFileSync(fullPath, "utf8");
        const definition = parseFileContent(fileName, content);
        if (!definition) return;
        await upsert(definition, "local", true);
      } catch {
        // Ignore watch parse errors; next successful write will restore state.
      }
    });
  };

  const ensureLoaded = async (): Promise<void> => {
    if (loaded) return;
    loaded = true;
    await loadFromDirectory();
    for (const definition of resolved.definitions ?? []) {
      await upsert(definition, "memory", true);
    }
    await startWatcher();
  };

  const registry: LoopRegistry & {
    __getEntry(id: LoopId): RegistryEntry | undefined;
  } = {
    async get(id: LoopId): Promise<LoopDefinition | null> {
      await ensureLoaded();
      return entries.get(id)?.definition ?? null;
    },

    async getVersion(id: LoopId, version: string): Promise<LoopDefinition | null> {
      await ensureLoaded();
      const definition = entries.get(id)?.definition;
      if (!definition) return null;
      return definition.version === version ? definition : null;
    },

    async list(optionsArg?: { domain?: string }): Promise<LoopDefinition[]> {
      await ensureLoaded();
      return [...entries.values()]
        .map((entry) => entry.definition)
        .filter((definition) => (optionsArg?.domain ? definition.domain === optionsArg.domain : true))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    },

    async has(id: LoopId): Promise<boolean> {
      await ensureLoaded();
      return entries.has(id);
    },

    async register(definition: LoopDefinition, registerOptions?: { force?: boolean }): Promise<void> {
      await ensureLoaded();
      await upsert(definition, "memory", registerOptions?.force === true);
    },

    async remove(id: LoopId): Promise<boolean> {
      await ensureLoaded();
      const removed = entries.delete(id);
      if (removed) {
        resolved.onChange?.({ type: "removed", loopId: toLoopId(String(id)) });
      }
      return removed;
    },

    // Test-only escape hatch for validating entry metadata.
    __getEntry(id: LoopId): RegistryEntry | undefined {
      return entries.get(id);
    }
  };

  return registry;
}

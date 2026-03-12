// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition, LoopId } from "@loop-engine/core";

export interface LoopRegistry {
  /**
   * Fetch a loop definition by id.
   * Returns null if not found (do not throw).
   */
  get(id: LoopId): Promise<LoopDefinition | null>;

  /**
   * Fetch a specific version of a loop definition.
   * Returns null if id or version not found.
   */
  getVersion(id: LoopId, version: string): Promise<LoopDefinition | null>;

  /**
   * List all registered loop definitions.
   * Optional domain filter: only return loops in this domain.
   */
  list(options?: { domain?: string }): Promise<LoopDefinition[]>;

  /**
   * Check if a loop definition exists.
   */
  has(id: LoopId): Promise<boolean>;

  /**
   * Register a loop definition.
   * Throws RegistryConflictError if loop with same id + version already exists.
   * Use force: true to overwrite (for development only).
   */
  register(definition: LoopDefinition, options?: { force?: boolean }): Promise<void>;

  /**
   * Remove a loop definition.
   * Returns true if removed, false if not found.
   */
  remove(id: LoopId): Promise<boolean>;
}

export interface RegistryEntry {
  definition: LoopDefinition;
  registeredAt: string;
  source: "local" | "http" | "betterdata" | "memory";
  checksum: string;
}

export type RegistryChangeEvent =
  | { type: "registered"; definition: LoopDefinition }
  | { type: "removed"; loopId: LoopId }
  | { type: "updated"; definition: LoopDefinition };

export interface LoopRegistryOptions {
  /**
   * Milliseconds to cache list() results.
   * 0 = no cache. Default: 60_000 (1 minute).
   */
  cacheTtlMs?: number;

  /**
   * Called when a loop is registered, updated, or removed.
   */
  onChange?: (event: RegistryChangeEvent) => void;
}

export class RegistryNotFoundError extends Error {
  constructor(
    public readonly loopId: LoopId,
    public readonly version?: string
  ) {
    super(version ? `Loop not found: ${loopId}@${version}` : `Loop not found: ${loopId}`);
    this.name = "RegistryNotFoundError";
  }
}

export class RegistryConflictError extends Error {
  constructor(
    public readonly loopId: LoopId,
    public readonly version: string
  ) {
    super(`Loop already registered: ${loopId}@${version}. Use force: true to overwrite.`);
    this.name = "RegistryConflictError";
  }
}

export class RegistryNetworkError extends Error {
  constructor(
    public readonly url: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(
      statusCode
        ? `Registry request failed: ${url} returned ${statusCode}`
        : `Registry request failed: ${url} — network error`
    );
    this.name = "RegistryNetworkError";
    if (cause) {
      this.cause = cause;
    }
  }
}

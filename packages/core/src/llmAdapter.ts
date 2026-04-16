// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * Multi-LLM adapter contract for Loop Engine state-machine steps.
 * Provider packages (e.g. `@loop-engine/adapter-perplexity`) implement this interface.
 */

export interface AdapterInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: AdapterInputMetadata;
}

export type SearchRecencyFilter = "month" | "week" | "day" | "hour";

export interface AdapterInputMetadata extends Record<string, unknown> {
  searchDomainFilter?: string[];
  searchRecencyFilter?: SearchRecencyFilter;
  returnCitations?: boolean;
  returnImages?: boolean;
}

export interface AdapterOutput {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AdapterChunk {
  delta: string;
  done?: boolean;
}

export interface LLMAdapter {
  name: string;
  invoke(input: AdapterInput): Promise<AdapterOutput>;
  stream?(input: AdapterInput): AsyncIterable<AdapterChunk>;
  guardEvidence(payload: unknown): unknown;
}

export interface GuardEvidenceOptions {
  /** Object keys to omit entirely (case-insensitive match). */
  stripFields?: string[];
  /** Regexes applied to string values to mask secrets (e.g. API key patterns). */
  maskPatterns?: RegExp[];
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

/**
 * Deep-redact payloads before logging or persisting to an audit trail.
 * Strips configured keys and masks matching substrings in strings.
 */
export function guardEvidence(payload: unknown, options?: GuardEvidenceOptions): unknown {
  const strip = new Set((options?.stripFields ?? []).map(normalizeKey));
  const masks = options?.maskPatterns ?? [];

  const walk = (value: unknown): unknown => {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      let s = value;
      for (const pattern of masks) {
        s = s.replace(pattern, "[REDACTED]");
      }
      return s;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "bigint") {
      return value;
    }
    if (value instanceof Date) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }
    if (typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (strip.has(normalizeKey(k))) {
          continue;
        }
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  };

  return walk(payload);
}

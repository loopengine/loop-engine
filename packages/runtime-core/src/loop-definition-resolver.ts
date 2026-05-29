// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { PrismaClient } from "@loop-engine/runtime-db";
import type { LoopDefinition } from "@loop-engine/sdk";
import { validateLoopDefinition } from "@loop-engine/sdk";

/**
 * RT-20d — loop definition resolution for the OSS self-host runtime.
 *
 * When `LOOP_ENGINE_REGISTRY_URL` is set (compose default), definitions are
 * fetched from registry-loop's v0 HTTP surface. Local `LoopDefinition` Postgres
 * rows remain the fallback for operator-seeded custom loops and for offline /
 * registry-less deployments.
 *
 * Uses direct fetch against `/v0/loops/*` rather than `@loop-engine/registry-client`
 * so the runtime cohort does not depend on the published npm registry-client
 * tarball (which predates `v0Registry`).
 */

export type LoopDefinitionResolver = {
  listActiveDefinitions(): Promise<LoopDefinition[]>;
  resolveLoopDefinition(loopId: string): Promise<{ definition: unknown } | null>;
};

type V0RegistryChannel = "stable" | "latest";

type V0ListResponse = {
  results: Array<{
    id: string;
    latestVersion: string | null;
    latestStableVersion: string | null;
  }>;
  nextCursor: string | null;
};

type V0LoopChannelResponse = {
  loop: V0ListResponse["results"][number];
  recommendedVersion: string | null;
};

type V0LoopArtifact = {
  id: string;
  version: string;
  definition: unknown;
};

function registryChannel(): V0RegistryChannel {
  const raw = (process.env.LOOP_ENGINE_REGISTRY_CHANNEL ?? "stable").toLowerCase().trim();
  return raw === "latest" ? "latest" : "stable";
}

function registryOrigin(): string | null {
  const baseUrl = process.env.LOOP_ENGINE_REGISTRY_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/$/, "").replace(/\/v0(\/.*)?$/, "").replace(/\/loops$/, "");
}

function registryHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.LOOP_ENGINE_REGISTRY_BEARER_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function pickListVersion(
  summary: V0ListResponse["results"][number],
  channel: V0RegistryChannel,
): string | null {
  if (channel === "stable") {
    return summary.latestStableVersion ?? summary.latestVersion;
  }
  return summary.latestVersion ?? summary.latestStableVersion;
}

function parseLoopDefinition(input: unknown): LoopDefinition | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as LoopDefinition;
  const validated = validateLoopDefinition(candidate);
  if (!validated.valid) {
    const detail = validated.errors.map((e) => `${e.code}: ${e.message}`).join("; ");
    console.warn(`[loop-engine] Skipping invalid registry definition: ${detail}`);
    return null;
  }
  return candidate;
}

async function fetchRegistryArtifact(
  origin: string,
  loopId: string,
  version: string,
): Promise<LoopDefinition | null> {
  const url = `${origin}/v0/loops/${encodeURIComponent(loopId)}/versions/${encodeURIComponent(version)}`;
  const response = await fetch(url, { headers: registryHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Registry artifact fetch failed (${response.status}) for ${loopId}@${version}`);
  }
  const raw = (await response.json()) as V0LoopArtifact;
  return parseLoopDefinition(raw.definition);
}

async function fetchRegistryLoop(
  origin: string,
  loopId: string,
  channel: V0RegistryChannel,
): Promise<LoopDefinition | null> {
  const summaryUrl = `${origin}/v0/loops/${encodeURIComponent(loopId)}?channel=${encodeURIComponent(channel)}`;
  const response = await fetch(summaryUrl, { headers: registryHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Registry summary fetch failed (${response.status}) for ${loopId}`);
  }
  const body = (await response.json()) as V0LoopChannelResponse;
  const version = body.recommendedVersion ?? pickListVersion(body.loop, channel);
  if (!version) return null;
  return fetchRegistryArtifact(origin, loopId, version);
}

async function listRegistryLoops(origin: string, channel: V0RegistryChannel): Promise<LoopDefinition[]> {
  const definitions: LoopDefinition[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${origin}/v0/loops`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, { headers: registryHeaders() });
    if (!response.ok) {
      throw new Error(`Registry list failed (${response.status})`);
    }
    const list = (await response.json()) as V0ListResponse;
    if (!Array.isArray(list.results)) {
      throw new Error("Registry list payload missing results[]");
    }

    for (const summary of list.results) {
      const version = pickListVersion(summary, channel);
      if (!version) continue;
      const definition = await fetchRegistryArtifact(origin, summary.id, version);
      if (definition) definitions.push(definition);
    }

    cursor = typeof list.nextCursor === "string" ? list.nextCursor : null;
  } while (cursor);

  return definitions;
}

async function loadLocalDefinitions(prisma: PrismaClient): Promise<LoopDefinition[]> {
  const rows = await prisma.loopDefinition.findMany({ where: { status: "active" } });
  const out: LoopDefinition[] = [];
  for (const row of rows) {
    const def = parseLoopDefinition(row.definition);
    if (def) out.push(def);
  }
  return out;
}

function dedupeByLoopId(definitions: LoopDefinition[]): LoopDefinition[] {
  const byId = new Map<string, LoopDefinition>();
  for (const def of definitions) {
    byId.set(String(def.id), def);
  }
  return [...byId.values()];
}

export function createLoopDefinitionResolver(prisma: PrismaClient): LoopDefinitionResolver {
  const origin = registryOrigin();
  const channel = registryChannel();

  return {
    async listActiveDefinitions(): Promise<LoopDefinition[]> {
      const local = await loadLocalDefinitions(prisma);
      if (!origin) return local;

      try {
        const remote = await listRegistryLoops(origin, channel);
        return dedupeByLoopId([...remote, ...local]);
      } catch (err) {
        console.warn(
          "[loop-engine] Registry list failed; falling back to local LoopDefinition rows:",
          err instanceof Error ? err.message : err,
        );
        return local;
      }
    },

    async resolveLoopDefinition(loopId: string): Promise<{ definition: unknown } | null> {
      const trimmed = loopId.trim();
      if (trimmed.length === 0) return null;

      if (origin) {
        try {
          const remote = await fetchRegistryLoop(origin, trimmed, channel);
          if (remote) return { definition: remote };
        } catch (err) {
          console.warn(
            `[loop-engine] Registry lookup failed for ${trimmed}; trying local DB:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      const row = await prisma.loopDefinition.findFirst({
        where: { loopId: trimmed, status: "active" },
        orderBy: { publishedAt: "desc" },
      });
      if (!row) return null;
      return { definition: row.definition as unknown };
    },
  };
}

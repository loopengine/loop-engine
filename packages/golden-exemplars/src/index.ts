// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EvidenceSnapshotProposed } from "@loop-engine/evidence";

export type GoldenExemplarFixture = {
  id: string;
  label: string;
  archetype: string;
  providerRole: string;
  snapshot: EvidenceSnapshotProposed;
};

const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

const FIXTURE_FILES = [
  "e01-governed-semantic-metric.json",
  "e02-adhoc-warehouse-query.json",
  "e03-semantic-bi-metric.json",
  "e04-dashboard-tile.json",
  "e05-telemetry-reading.json",
  "e06-collaborative-document.json",
  "e07-signed-pdf.json",
  "e08-model-summary.json",
  "e09-physical-anchor-reading.json",
  "e10-manual-upload.json",
] as const;

/** Set 0.5 exemplar ids (E01–E10). */
export const LOADED_EXEMPLAR_IDS = [
  "E01",
  "E02",
  "E03",
  "E04",
  "E05",
  "E06",
  "E07",
  "E08",
  "E09",
  "E10",
] as const;

export function loadGoldenExemplars(): GoldenExemplarFixture[] {
  return FIXTURE_FILES.map((file) => {
    const raw = readFileSync(path.join(FIXTURE_DIR, file), "utf8");
    return JSON.parse(raw) as GoldenExemplarFixture;
  });
}

export function loadGoldenExemplar(id: string): GoldenExemplarFixture | undefined {
  return loadGoldenExemplars().find((row) => row.id === id);
}

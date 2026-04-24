// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition } from "@loop-engine/core";
import { stringify } from "yaml";

function buildCanonical(definition: LoopDefinition): Record<string, unknown> {
  const canonical: Record<string, unknown> = {
    id: definition.id,
    version: definition.version,
    name: definition.name,
    description: definition.description,
    states: definition.states,
    initialState: definition.initialState,
    transitions: definition.transitions,
    outcome: definition.outcome
  };

  if (definition.domain) {
    canonical.domain = definition.domain;
  }

  if (definition.tags) {
    canonical.tags = definition.tags;
  }

  return canonical;
}

export function serializeLoopYaml(definition: LoopDefinition): string {
  return stringify(buildCanonical(definition), {
    lineWidth: 100
  });
}

export function serializeLoopJson(definition: LoopDefinition, space: number = 2): string {
  return JSON.stringify(buildCanonical(definition), null, space);
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition } from "@loop-engine/core";
import { stringify } from "yaml";

export function serializeLoopYaml(definition: LoopDefinition): string {
  const canonical: Record<string, unknown> = {
    loopId: definition.loopId,
    version: definition.version,
    name: definition.name,
    description: definition.description,
    states: definition.states,
    initialState: definition.initialState,
    transitions: definition.transitions,
    outcome: definition.outcome
  };

  if (definition.tags) {
    canonical.tags = definition.tags;
  }

  return stringify(canonical, {
    lineWidth: 100
  });
}

export function serializeLoopJson(definition: LoopDefinition, space: number = 2): string {
  const canonical: Record<string, unknown> = {
    loopId: definition.loopId,
    version: definition.version,
    name: definition.name,
    description: definition.description,
    states: definition.states,
    initialState: definition.initialState,
    transitions: definition.transitions,
    outcome: definition.outcome
  };

  if (definition.tags) {
    canonical.tags = definition.tags;
  }

  return JSON.stringify(canonical, null, space);
}

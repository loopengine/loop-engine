// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import yaml from "js-yaml";
import type { LoopDefinition } from "@loop-engine/core";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys(record[key]);
        return acc;
      }, {});
  }
  return value;
}

export function serializeToYaml(definition: LoopDefinition): string {
  return yaml.dump(sortKeys(definition), {
    lineWidth: 100,
    noRefs: true,
    sortKeys: true
  });
}

export function serializeToJson(definition: LoopDefinition, pretty = true): string {
  return JSON.stringify(sortKeys(definition), null, pretty ? 2 : 0);
}

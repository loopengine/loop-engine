// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { LoopDefinitionSchema, type LoopDefinition } from "@loop-engine/core";
import { parse } from "yaml";
import { applyAuthoringDefaults } from "./applyAuthoringDefaults";

function formatPath(path: Array<string | number>): string {
  return path.length > 0 ? path.join(".") : "root";
}

export function parseLoopYaml(yamlContent: string): LoopDefinition {
  let parsed: unknown;
  try {
    parsed = parse(yamlContent);
  } catch (error) {
    throw new Error(
      `Invalid YAML syntax: ${error instanceof Error ? error.message : "Unknown parse error"}`
    );
  }

  const result = LoopDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`);
    throw new Error(`Loop definition validation failed: ${issues.join("; ")}`);
  }

  return applyAuthoringDefaults(result.data);
}

export function parseLoopYamlSafe(
  yamlContent: string
): { success: true; data: LoopDefinition } | { success: false; error: string } {
  try {
    return { success: true, data: parseLoopYaml(yamlContent) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown parse error" };
  }
}

export function parseLoopJson(jsonContent: string): LoopDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(
      `Invalid JSON syntax: ${error instanceof Error ? error.message : "Unknown parse error"}`
    );
  }

  const result = LoopDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`);
    throw new Error(`Loop definition validation failed: ${issues.join("; ")}`);
  }

  return applyAuthoringDefaults(result.data);
}

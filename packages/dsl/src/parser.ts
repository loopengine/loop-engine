// @license MIT
// SPDX-License-Identifier: MIT
import yaml from "js-yaml";
import type { LoopDefinition } from "@loop-engine/core";
import { validateLoopDefinition } from "./schema";

export class ParseError extends Error {
  line: number | undefined;
  column: number | undefined;
  fieldPath: string | undefined;

  constructor(
    message: string,
    opts?: { line?: number | undefined; column?: number | undefined; fieldPath?: string | undefined }
  ) {
    super(message);
    this.name = "ParseError";
    this.line = opts?.line;
    this.column = opts?.column;
    this.fieldPath = opts?.fieldPath;
  }
}

function parseUnknown(input: unknown): LoopDefinition {
  const result = validateLoopDefinition(input);
  if (!result.valid) {
    const first = result.errors[0] ?? "Invalid loop definition";
    const fieldPath = first.includes(":") ? first.split(":")[0] : undefined;
    throw new ParseError(first, fieldPath ? { fieldPath } : undefined);
  }
  return result.definition as LoopDefinition;
}

export function parseLoopYaml(yamlContent: string): LoopDefinition {
  try {
    const parsed = yaml.load(yamlContent);
    return parseUnknown(parsed);
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    const yamlError = error as { message?: string; mark?: { line?: number; column?: number } };
    if (yamlError?.mark) {
      const line = yamlError.mark.line;
      const column = yamlError.mark.column;
      throw new ParseError(yamlError.message ?? "YAML parse error", {
        ...(line !== undefined ? { line } : {}),
        ...(column !== undefined ? { column } : {})
      });
    }
    throw new ParseError("Unable to parse YAML loop definition");
  }
}

export function parseLoopJson(json: string): LoopDefinition {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parseUnknown(parsed);
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(error instanceof Error ? error.message : "Unable to parse JSON");
  }
}

export function parseLoopFile(content: string, format: "yaml" | "json"): LoopDefinition {
  return format === "yaml" ? parseLoopYaml(content) : parseLoopJson(content);
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import * as YAML from "yaml";
import { LoopDefinitionSchema, type ActorType, type LoopDefinition } from "../packages/core/src/schemas";

type ValidationError = {
  file: string;
  message: string;
};

function normalizeActorType(value: unknown): ActorType {
  if (value === "human" || value === "automation" || value === "ai-agent") {
    return value;
  }
  // Legacy loop definitions may include proprietary actor types.
  // For schema validation, treat them as automation-equivalent.
  if (value === "system" || value === "webhook") {
    return "automation";
  }
  return "human";
}

function normalizeLoopDefinition(input: unknown): LoopDefinition {
  const source = (input ?? {}) as Record<string, unknown>;
  const states = Array.isArray(source.states) ? source.states : [];
  const transitions = Array.isArray(source.transitions) ? source.transitions : [];
  const rawOutcome = source.outcome as Record<string, unknown> | undefined;
  const normalized = {
    loopId: String(source.loopId ?? source.id ?? ""),
    version: String(source.version ?? "1.0.0"),
    name: String(source.name ?? source.id ?? source.loopId ?? "loop"),
    description: String(source.description ?? ""),
    states: states.map((state) => {
      const s = (state ?? {}) as Record<string, unknown>;
      return {
        stateId: String(s.stateId ?? s.id ?? ""),
        label: String(s.label ?? s.id ?? s.stateId ?? ""),
        ...(typeof s.terminal === "boolean"
          ? { terminal: s.terminal }
          : typeof s.isTerminal === "boolean"
            ? { terminal: s.isTerminal }
            : {})
      };
    }),
    initialState: String(source.initialState ?? ""),
    transitions: transitions.map((transition) => {
      const t = (transition ?? {}) as Record<string, unknown>;
      const allowedActors = Array.isArray(t.allowedActors) ? t.allowedActors : [];
      const guards = Array.isArray(t.guards)
        ? t.guards.map((guard) => {
            const g = (guard ?? {}) as Record<string, unknown>;
            return {
              guardId: String(g.guardId ?? g.id ?? ""),
              description: String(g.description ?? g.failureMessage ?? g.guardId ?? g.id ?? "Guard check"),
              severity: g.severity === "soft" ? "soft" : "hard",
              evaluatedBy:
                g.evaluatedBy === "runtime" || g.evaluatedBy === "module" || g.evaluatedBy === "external"
                  ? g.evaluatedBy
                  : "external",
              ...(g.parameters && typeof g.parameters === "object"
                ? { parameters: g.parameters as Record<string, unknown> }
                : {})
            };
          })
        : undefined;
      return {
        transitionId: String(t.transitionId ?? t.id ?? ""),
        from: String(t.from ?? ""),
        to: String(t.to ?? ""),
        signal: String(t.signal ?? t.on ?? t.transitionId ?? t.id ?? ""),
        allowedActors: allowedActors.map(normalizeActorType),
        ...(guards ? { guards } : {})
      };
    }),
    ...(rawOutcome && typeof rawOutcome === "object"
      ? {
          outcome: {
            description: String(rawOutcome.description ?? rawOutcome.id ?? "Loop outcome"),
            valueUnit: String(rawOutcome.valueUnit ?? "unit"),
            businessMetrics: Array.isArray(rawOutcome.businessMetrics)
              ? rawOutcome.businessMetrics
              : []
          }
        }
      : {})
  };
  return LoopDefinitionSchema.parse(normalized);
}

function formatSchemaErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    const issues = error.issues
      .map((issue) => {
        const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : "root";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    return `Loop definition validation failed: ${issues}`;
  }
  return error instanceof Error ? error.message : "Unknown validation error";
}

async function walkYamlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkYamlFiles(full)));
    } else if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
      out.push(full);
    }
  }
  return out;
}

function relativeFromRepoRoot(absPath: string): string {
  const root = process.cwd();
  return path.relative(root, absPath);
}

async function validateFile(filePath: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = YAML.parse(content);
    const definition = normalizeLoopDefinition(parsed);

    const stateIds = new Set(definition.states.map((s) => s.stateId));
    const terminalIds = new Set(definition.states.filter((s) => s.terminal).map((s) => s.stateId));

    if (!stateIds.has(definition.initialState)) {
      errors.push({
        file: filePath,
        message: `initialState ${definition.initialState} missing from states`
      });
    }

    if (terminalIds.size === 0) {
      errors.push({
        file: filePath,
        message: "at least one terminal state is required"
      });
    }

    const hasTransitionToTerminal = definition.transitions.some((t) => terminalIds.has(t.to));
    if (!hasTransitionToTerminal) {
      errors.push({
        file: filePath,
        message: "at least one transition must lead to a terminal state"
      });
    }

    for (const transition of definition.transitions) {
      if (!stateIds.has(transition.from)) {
        errors.push({
          file: filePath,
          message: `transition ${transition.transitionId} from ${transition.from} not found in states`
        });
      }
      if (!stateIds.has(transition.to)) {
        errors.push({
          file: filePath,
          message: `transition ${transition.transitionId} to ${transition.to} not found in states`
        });
      }
    }

    if (errors.length === 0) {
      // Required output format from prompt gate.
      console.log(`✓ ${relativeFromRepoRoot(filePath)} (v${definition.version})`);
    }
  } catch (error) {
    const isYamlParseError =
      error instanceof YAML.YAMLParseError ||
      (error && typeof error === "object" && "name" in error && error.name === "YAMLParseError");
    if (isYamlParseError) {
      const yamlError = error as { line?: number; column?: number; message?: string };
      const location =
        typeof yamlError.line === "number" && typeof yamlError.column === "number"
          ? ` (line ${yamlError.line + 1}, col ${yamlError.column + 1})`
          : "";
      errors.push({
        file: filePath,
        message: `${yamlError.message ?? "YAML parse error"}${location}`
      });
    } else {
      errors.push({
        file: filePath,
        message: formatSchemaErrorMessage(error)
      });
    }
  }
  return errors;
}

async function main(): Promise<void> {
  const loopsDir = path.join(process.cwd(), "loops");
  const files = (await walkYamlFiles(loopsDir)).sort();
  if (files.length === 0) {
    console.error("No loop definition files found under loops/**/*.yaml");
    process.exit(1);
  }

  const errors: ValidationError[] = [];
  for (const file of files) {
    errors.push(...(await validateFile(file)));
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`✗ ${relativeFromRepoRoot(error.file)}: ${error.message}`);
    }
    process.exit(1);
  }
}

void main();

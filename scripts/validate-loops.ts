// @license MIT
// SPDX-License-Identifier: MIT
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ParseError, parseLoopYaml } from "../packages/dsl/src/parser";

type ValidationError = {
  file: string;
  message: string;
};

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
    const definition = parseLoopYaml(content);

    const stateIds = new Set(definition.states.map((s) => s.id));
    const terminalIds = new Set(definition.states.filter((s) => s.isTerminal).map((s) => s.id));

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
          message: `transition ${transition.id} from ${transition.from} not found in states`
        });
      }
      if (!stateIds.has(transition.to)) {
        errors.push({
          file: filePath,
          message: `transition ${transition.id} to ${transition.to} not found in states`
        });
      }
    }

    if (errors.length === 0) {
      // Required output format from prompt gate.
      console.log(`✓ ${relativeFromRepoRoot(filePath)} (v${definition.version})`);
    }
  } catch (error) {
    if (error instanceof ParseError) {
      const location =
        typeof error.line === "number" && typeof error.column === "number"
          ? ` (line ${error.line + 1}, col ${error.column + 1})`
          : "";
      errors.push({
        file: filePath,
        message: `${error.message}${location}`
      });
    } else {
      errors.push({
        file: filePath,
        message: error instanceof Error ? error.message : "Unknown validation error"
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

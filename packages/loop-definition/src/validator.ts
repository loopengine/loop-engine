// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { LoopDefinition } from "@loop-engine/core";

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function findTerminalStates(definition: LoopDefinition): Set<string> {
  return new Set(
    definition.states.filter((state) => state.terminal).map((state) => String(state.stateId))
  );
}

function hasPathToTerminal(definition: LoopDefinition, terminalStates: Set<string>): boolean {
  const graph = new Map<string, Set<string>>();

  for (const transition of definition.transitions) {
    const from = String(transition.from);
    const to = String(transition.to);
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from)?.add(to);
  }

  const start = String(definition.initialState);
  const visited = new Set<string>();
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (terminalStates.has(current)) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const nextStates = graph.get(current) ?? new Set<string>();
    for (const next of nextStates) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return false;
}

function checkSignalCycles(definition: LoopDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  const transitions = definition.transitions;

  for (let i = 0; i < transitions.length; i += 1) {
    const a = transitions[i];
    if (!a) continue;
    const signal = String(a.signal);
    const from = String(a.from);
    const to = String(a.to);

    for (let j = 0; j < transitions.length; j += 1) {
      if (i === j) continue;
      const b = transitions[j];
      if (!b) continue;
      if (
        String(b.signal) === signal &&
        String(b.from) === to &&
        String(b.to) === from
      ) {
        errors.push({
          code: "SIGNAL_CYCLE_DETECTED",
          message: `Signal "${signal}" creates a two-way cycle between "${from}" and "${to}"`,
          path: `transitions.${i}.signal`
        });
      }
    }
  }

  return errors;
}

export function validateLoopDefinition(definition: LoopDefinition): ValidationResult {
  const errors: ValidationError[] = [];
  const stateIds = new Set(definition.states.map((state) => String(state.stateId)));
  const initialState = String(definition.initialState);

  if (!stateIds.has(initialState)) {
    errors.push({
      code: "INVALID_INITIAL_STATE",
      message: `initialState "${initialState}" does not exist in states`,
      path: "initialState"
    });
  }

  definition.transitions.forEach((transition, index) => {
    const from = String(transition.from);
    const to = String(transition.to);
    if (!stateIds.has(from)) {
      errors.push({
        code: "INVALID_TRANSITION_STATE",
        message: `transition.from "${from}" does not exist in states`,
        path: `transitions.${index}.from`
      });
    }
    if (!stateIds.has(to)) {
      errors.push({
        code: "INVALID_TRANSITION_STATE",
        message: `transition.to "${to}" does not exist in states`,
        path: `transitions.${index}.to`
      });
    }

    if (transition.guards) {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const guard of transition.guards) {
        const guardId = String(guard.guardId);
        if (seen.has(guardId)) duplicates.add(guardId);
        seen.add(guardId);
      }
      if (duplicates.size > 0) {
        errors.push({
          code: "DUPLICATE_GUARD_ID",
          message: `duplicate guardId(s) in transition "${String(transition.transitionId)}": ${Array.from(duplicates).join(", ")}`,
          path: `transitions.${index}.guards`
        });
      }
    }
  });

  const terminalStates = findTerminalStates(definition);
  if (terminalStates.size === 0) {
    errors.push({
      code: "NO_TERMINAL_STATE",
      message: "at least one state must be terminal",
      path: "states"
    });
  } else {
    const hasTerminalInbound = definition.transitions.some((transition) =>
      terminalStates.has(String(transition.to))
    );
    if (!hasTerminalInbound || !hasPathToTerminal(definition, terminalStates)) {
      errors.push({
        code: "LOOP_NOT_COMPLETABLE",
        message: "loop has no reachable path from initialState to a terminal state"
      });
    }
  }

  errors.push(...checkSignalCycles(definition));

  if (
    definition.outcome &&
    (!Array.isArray(definition.outcome.businessMetrics) ||
      definition.outcome.businessMetrics.length === 0)
  ) {
    errors.push({
      code: "OUTCOME_METRICS_REQUIRED",
      message: "outcome.businessMetrics must be non-empty when outcome is defined",
      path: "outcome.businessMetrics"
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

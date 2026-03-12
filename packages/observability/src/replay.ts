// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition } from "@loop-engine/core";
import type { RuntimeTransitionRecord } from "@loop-engine/runtime";

export function replayLoop(
  definition: LoopDefinition,
  history: RuntimeTransitionRecord[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let state = definition.initialState;
  for (const record of history) {
    const match = definition.transitions.find(
      (transition) =>
        transition.transitionId === record.transitionId &&
        transition.from === state &&
        transition.to === record.toState
    );
    if (!match) {
      errors.push(`Invalid transition ${record.transitionId} from ${state} to ${record.toState}`);
      continue;
    }
    state = record.toState;
  }
  return { valid: errors.length === 0, errors };
}

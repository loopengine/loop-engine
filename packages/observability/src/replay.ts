// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition, TransitionRecord } from "@loop-engine/core";

export function replayLoop(
  definition: LoopDefinition,
  history: TransitionRecord[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let state = definition.initialState;
  for (const record of history) {
    const match = definition.transitions.find(
      (t) => t.id === record.transitionId && t.from === state && t.to === record.toState
    );
    if (!match) {
      errors.push(`Invalid transition ${record.transitionId} from ${state} to ${record.toState}`);
      continue;
    }
    state = record.toState;
  }
  return { valid: errors.length === 0, errors };
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { LoopDefinition, SignalId } from "@loop-engine/core";

/**
 * Boundary-defaulting helper for authored `LoopDefinition` instances
 * (D-05 extension; PB-EX-05 Option B).
 *
 * `TransitionSpec.signal` is optional at the authoring layer but required
 * at the runtime layer (`TransitionRecord.signal: SignalId`, validator
 * uniqueness check, event-stream consumers). This helper bridges the two
 * by defaulting `signal := transition.id as SignalId` whenever an
 * authored transition omits `signal`.
 *
 * Invoke at every authoring surface that produces a `LoopDefinition`
 * destined for the runtime: parser wrappers (`parseLoopYaml`,
 * `parseLoopJson`), registry adapters (local + http), and any other
 * `LoopDefinitionSchema.parse` call site that hands its output to
 * `LoopEngine` / `LoopStore`. `LoopBuilder.build()` performs the
 * equivalent fill pre-parse and therefore does not need this post-parse
 * helper.
 *
 * See `API_SURFACE_DECISIONS_RESOLVED.md` §2 D-05 extension (PB-EX-05
 * Option B) for the layered contract.
 */
export function applyAuthoringDefaults(definition: LoopDefinition): LoopDefinition {
  let mutated = false;
  const transitions = definition.transitions.map((transition) => {
    if (transition.signal !== undefined) {
      return transition;
    }
    mutated = true;
    return { ...transition, signal: transition.id as unknown as SignalId };
  });

  if (!mutated) {
    return definition;
  }

  return { ...definition, transitions };
}

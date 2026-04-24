// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type {
  ActorId,
  AggregateId,
  GuardId,
  LoopId,
  SignalId,
  StateId,
  TransitionId
} from "./schemas";

/**
 * Brand-cast factory functions for the seven `1.0.0-rc.0` ID types.
 *
 * Each factory is a pure type-level cast: it takes a `string` and
 * returns the corresponding branded `*Id` type. There is no runtime
 * validation — the factories exist solely so consumers can construct
 * branded values without the inline `as LoopId` cast at every call
 * site, and so that test fixtures, examples, and migration code can
 * spell their intent at the type level.
 *
 * If runtime validation is needed (e.g., constraining the format of a
 * `LoopId`), use the corresponding `*Schema` from `./schemas` directly
 * (exported from this same package):
 *
 * ```ts
 * const id = LoopIdSchema.parse(input); // throws on invalid
 * ```
 *
 * Per D-01 → A in `API_SURFACE_DECISIONS_RESOLVED.md`. The set is
 * exactly seven (loopId, aggregateId, transitionId, guardId,
 * signalId, stateId, actorId); `outcomeId` and `correlationId`
 * factories are deliberately **not** included here — those brand
 * schemas (`OutcomeIdSchema`, `CorrelationIdSchema`) exist for D-02
 * but the factories are out of scope for D-01 and may be added in a
 * future cycle if SDK consumer experience surfaces a need.
 */

export const loopId = (s: string): LoopId => s as LoopId;
export const aggregateId = (s: string): AggregateId => s as AggregateId;
export const transitionId = (s: string): TransitionId => s as TransitionId;
export const guardId = (s: string): GuardId => s as GuardId;
export const signalId = (s: string): SignalId => s as SignalId;
export const stateId = (s: string): StateId => s as StateId;
export const actorId = (s: string): ActorId => s as ActorId;

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AggregateId, LoopId } from "@loop-engine/core";

export interface LoopEventBase {
  eventId: string;
  type: string;
  loopId: LoopId;
  aggregateId: AggregateId;
  occurredAt: string;
  correlationId?: string | undefined;
  causationId?: string | undefined;
}

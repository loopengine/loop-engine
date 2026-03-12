// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { ActorRef, SignalId } from "@loop-engine/core";
import type { z } from "zod";

export interface SignalSpec {
  signalId: SignalId;
  name: string;
  description?: string;
  schema?: z.ZodType;
  tags?: string[];
}

export interface SignalPayload<T = Record<string, unknown>> {
  signalId: SignalId;
  payload: T;
  issuedAt: string;
  issuedBy: ActorRef;
}

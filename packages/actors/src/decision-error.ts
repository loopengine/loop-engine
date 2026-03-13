// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import type { ActorDecisionErrorCode } from "./types";

export class ActorDecisionError extends Error {
  readonly code: ActorDecisionErrorCode;
  readonly raw?: unknown;

  constructor(params: { code: ActorDecisionErrorCode; message?: string; raw?: unknown }) {
    super(params.message ?? params.code);
    this.name = "ActorDecisionError";
    this.code = params.code;
    if (params.raw !== undefined) {
      this.raw = params.raw;
    }
  }
}

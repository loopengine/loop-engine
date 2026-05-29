// SPDX-License-Identifier: Apache-2.0

import { RUNTIME_API_CONTRACT_VERSION } from "@loop-engine/observability";
import { StudioClientError } from "./errors.js";

export function assertContractPayload<T extends { contractVersion: string }>(
  payload: T,
  expected: string = RUNTIME_API_CONTRACT_VERSION,
): T {
  if (payload.contractVersion !== expected) {
    throw new StudioClientError(
      "contract_mismatch",
      `Expected contractVersion ${expected}, got ${payload.contractVersion}`,
      { body: payload },
    );
  }
  return payload;
}

export function isRunDetailPayload(value: unknown): value is {
  contractVersion: string;
  run: { loopRunId: string; loopId: string };
} {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.contractVersion === "string" && typeof v.run === "object" && v.run !== null;
}

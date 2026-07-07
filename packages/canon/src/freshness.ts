// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type { FreshnessBindingClock, FreshnessQualification } from "@loop-engine/evidence";

export function freshnessBindingTimestamp(
  freshness: Extract<FreshnessQualification, { applicable: "applicable" }>,
  bindingClock: FreshnessBindingClock = freshness.bindingClock ?? "valueAsOf",
): string {
  if (bindingClock === "snapshotFrozenAt") {
    return freshness.snapshotFrozenAt;
  }
  if (bindingClock === "sourceDataFreshness") {
    return freshness.sourceDataFreshness ?? freshness.valueAsOf;
  }
  return freshness.valueAsOf;
}

export function freshnessAgeMs(
  freshness: Extract<FreshnessQualification, { applicable: "applicable" }>,
  evaluatedAt: string,
  bindingClock?: FreshnessBindingClock,
): number {
  const bindingIso = freshnessBindingTimestamp(freshness, bindingClock);
  const evaluated = Date.parse(evaluatedAt);
  const binding = Date.parse(bindingIso);
  if (Number.isNaN(evaluated) || Number.isNaN(binding)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, evaluated - binding);
}

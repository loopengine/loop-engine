// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/**
 * ADR-0005 Qualification Vector — P/D/F axes (Set 0 Provider Contract).
 *
 * Qualification is inherited from provider mapping, never caller-asserted (ADR-0004 C1).
 */

/** Axis P — Provenance (universal). */
export type ProvenanceRung = "unknown" | "system-attested" | "origin-attested";

/** Axis D — Definition (derived values; `not-applicable` for raw facts). */
export type DefinitionRung =
  | "not-applicable"
  | "unreviewed"
  | "certified"
  | "governed";

export type FreshnessVerdict = "fresh" | "stale" | "unknown";

export type FreshnessBindingClock =
  | "snapshotFrozenAt"
  | "valueAsOf"
  | "sourceDataFreshness";

/** Axis F — Freshness (where temporal; identity constraints use `version` instead). */
export type FreshnessQualification =
  | { applicable: "not-applicable" }
  | {
      applicable: "applicable";
      snapshotFrozenAt: string;
      valueAsOf: string;
      sourceDataFreshness?: string;
      freshnessSla?: string;
      freshnessVerdict?: FreshnessVerdict;
      /** Two-clock sources: binding (stalest) clock for role evaluation. */
      bindingClock?: FreshnessBindingClock;
    };

/** Open extensible vector — only P/D/F defined at launch (ADR-0005). */
export type QualificationVector = {
  provenance: ProvenanceRung;
  definition: DefinitionRung;
  freshness: FreshnessQualification;
};

/** Version identity constraint — not an ordered axis (ADR-0005). */
export type VersionIdentityConstraint = {
  kind: "must_equal" | "must_be_in";
  value: string | string[];
};

/** Compare ordered rungs on a single axis (≥ semantics for P/D; F uses age separately). */
export const PROVENANCE_ORDER: readonly ProvenanceRung[] = [
  "unknown",
  "system-attested",
  "origin-attested",
];

export const DEFINITION_ORDER: readonly DefinitionRung[] = [
  "not-applicable",
  "unreviewed",
  "certified",
  "governed",
];

export function provenanceMeetsMinimum(
  actual: ProvenanceRung,
  required: ProvenanceRung,
): boolean {
  return (
    PROVENANCE_ORDER.indexOf(actual) >= PROVENANCE_ORDER.indexOf(required)
  );
}

export function definitionMeetsMinimum(
  actual: DefinitionRung,
  required: DefinitionRung,
): boolean {
  if (actual === "not-applicable" || required === "not-applicable") {
    return true;
  }
  return (
    DEFINITION_ORDER.indexOf(actual) >= DEFINITION_ORDER.indexOf(required)
  );
}

export function isFreshnessApplicable(
  freshness: FreshnessQualification,
): freshness is Extract<FreshnessQualification, { applicable: "applicable" }> {
  return freshness.applicable === "applicable";
}

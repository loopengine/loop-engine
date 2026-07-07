// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import type {
  DefinitionRung,
  FreshnessBindingClock,
  ProvenanceRung,
  QualificationVector,
} from "@loop-engine/evidence";

/** Freshness requirement for a Canon role — age bound on binding clock. */
export type CanonFreshnessRequirement =
  | { applicable: "not-applicable" }
  | {
      applicable: "applicable";
      /** Maximum age in milliseconds from binding clock to evaluation time. */
      maxAgeMs: number;
      bindingClock?: FreshnessBindingClock;
    };

/** Per-role qualification floor — provider-neutral (ADR-0005). */
export type EvidenceRoleRequirement = {
  role: string;
  provenance?: ProvenanceRung;
  definition?: DefinitionRung;
  freshness?: CanonFreshnessRequirement;
  /** When true, snapshot must carry conformant provider metadata. */
  requiresConformantProvider?: boolean;
};

/** Policy document shape — content is Enterprise; evaluator is OSS. */
export type CanonPolicyDocument = {
  decisionSystem: string;
  requiresEvidence: EvidenceRoleRequirement[];
};

export type CanonEvaluationFailure = {
  code: string;
  message: string;
  role: string;
  axis?: "provenance" | "definition" | "freshness" | "conformance";
};

export type RoleEvaluationInput = {
  role: string;
  qualification: QualificationVector;
  providerId?: string;
  conformanceSuiteVersion?: string;
  providerConformant?: boolean;
  /** ISO-8601 evaluation instant; defaults to freshness.snapshotFrozenAt when absent. */
  evaluatedAt?: string;
};

export type RoleEvaluationResult = {
  role: string;
  satisfied: boolean;
  failures: CanonEvaluationFailure[];
};

export type CanonPolicyEvaluationResult = {
  decisionSystem: string;
  satisfied: boolean;
  roles: RoleEvaluationResult[];
};

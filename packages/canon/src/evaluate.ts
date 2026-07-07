// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import {
  definitionMeetsMinimum,
  provenanceMeetsMinimum,
  type DefinitionRung,
  type ProvenanceRung,
} from "@loop-engine/evidence";
import { freshnessAgeMs } from "./freshness.js";
import type {
  CanonEvaluationFailure,
  CanonPolicyDocument,
  CanonPolicyEvaluationResult,
  EvidenceRoleRequirement,
  RoleEvaluationInput,
  RoleEvaluationResult,
} from "./types.js";

function isConformantProvider(input: RoleEvaluationInput): boolean {
  if (input.providerConformant !== undefined) {
    return input.providerConformant;
  }
  return Boolean(input.providerId && input.conformanceSuiteVersion);
}

function evaluateProvenance(
  requirement: EvidenceRoleRequirement,
  input: RoleEvaluationInput,
): CanonEvaluationFailure[] {
  const required = requirement.provenance;
  if (!required) return [];

  const actual = input.qualification.provenance;
  if (provenanceMeetsMinimum(actual, required)) {
    return [];
  }

  return [{
    code: "provenance_below_minimum",
    message: `provenance ${actual} does not meet required ${required}`,
    role: requirement.role,
    axis: "provenance",
  }];
}

function evaluateDefinition(
  requirement: EvidenceRoleRequirement,
  input: RoleEvaluationInput,
): CanonEvaluationFailure[] {
  const required = requirement.definition;
  if (!required) return [];

  const actual = input.qualification.definition;
  if (definitionMeetsMinimum(actual, required)) {
    return [];
  }

  return [{
    code: "definition_below_minimum",
    message: `definition ${actual} does not meet required ${required}`,
    role: requirement.role,
    axis: "definition",
  }];
}

function evaluateFreshness(
  requirement: EvidenceRoleRequirement,
  input: RoleEvaluationInput,
): CanonEvaluationFailure[] {
  const required = requirement.freshness;
  if (!required) return [];

  const actual = input.qualification.freshness;
  if (required.applicable === "not-applicable") {
    return [];
  }

  if (actual.applicable === "not-applicable") {
    return [{
      code: "freshness_required",
      message: "freshness is required for this role but snapshot reports not-applicable",
      role: requirement.role,
      axis: "freshness",
    }];
  }

  const evaluatedAt =
    input.evaluatedAt ?? actual.snapshotFrozenAt ?? actual.valueAsOf;
  const ageMs = freshnessAgeMs(actual, evaluatedAt, required.bindingClock);
  if (ageMs <= required.maxAgeMs) {
    return [];
  }

  return [{
    code: "freshness_stale",
    message: `freshness age ${ageMs}ms exceeds max ${required.maxAgeMs}ms`,
    role: requirement.role,
    axis: "freshness",
  }];
}

function evaluateConformance(
  requirement: EvidenceRoleRequirement,
  input: RoleEvaluationInput,
): CanonEvaluationFailure[] {
  if (!requirement.requiresConformantProvider) {
    return [];
  }
  if (isConformantProvider(input)) {
    return [];
  }
  return [{
    code: "provider_not_conformant",
    message: "role requires conformant provider metadata on snapshot",
    role: requirement.role,
    axis: "conformance",
  }];
}

/** Evaluate one role requirement against a qualified snapshot. */
export function evaluateRoleRequirement(
  requirement: EvidenceRoleRequirement,
  input: RoleEvaluationInput,
): RoleEvaluationResult {
  const failures = [
    ...evaluateProvenance(requirement, input),
    ...evaluateDefinition(requirement, input),
    ...evaluateFreshness(requirement, input),
    ...evaluateConformance(requirement, input),
  ];

  return {
    role: requirement.role,
    satisfied: failures.length === 0,
    failures,
  };
}

/** Evaluate all role requirements in a policy document. */
export function evaluateCanonPolicy(
  policy: CanonPolicyDocument,
  snapshotsByRole: Record<string, RoleEvaluationInput | undefined>,
): CanonPolicyEvaluationResult {
  const roles = policy.requiresEvidence.map((requirement) => {
    const input = snapshotsByRole[requirement.role];
    if (!input) {
      return {
        role: requirement.role,
        satisfied: false,
        failures: [{
          code: "role_snapshot_missing",
          message: `no snapshot supplied for role ${requirement.role}`,
          role: requirement.role,
        }],
      } satisfies RoleEvaluationResult;
    }
    return evaluateRoleRequirement(requirement, {
      ...input,
      role: requirement.role,
    });
  });

  return {
    decisionSystem: policy.decisionSystem,
    satisfied: roles.every((role) => role.satisfied),
    roles,
  };
}

/** Helper for policy authors — minimum rung labels in requirement objects. */
export const CanonMinimum = {
  provenance: (rung: ProvenanceRung) => rung,
  definition: (rung: DefinitionRung) => rung,
} as const;

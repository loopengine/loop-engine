// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { evaluateCanonPolicy, evaluateRoleRequirement } from "../evaluate.js";
import type { CanonPolicyDocument } from "../types.js";

const supplierInvoicePolicy: CanonPolicyDocument = {
  decisionSystem: "supplier-invoice-approval",
  requiresEvidence: [
    {
      role: "source_invoice",
      provenance: "system-attested",
      definition: "not-applicable",
      freshness: { applicable: "not-applicable" },
    },
    {
      role: "semantic_spend_validation",
      provenance: "system-attested",
      definition: "certified",
      freshness: { applicable: "applicable", maxAgeMs: 86_400_000 },
      requiresConformantProvider: true,
    },
  ],
};

describe("canon evaluator", () => {
  it("skips definition check when requirement axis is not-applicable", () => {
    const result = evaluateRoleRequirement(
      {
        role: "source_invoice",
        definition: "governed",
      },
      {
        role: "source_invoice",
        qualification: {
          provenance: "system-attested",
          definition: "not-applicable",
          freshness: { applicable: "not-applicable" },
        },
      },
    );
    expect(result.satisfied).toBe(true);
  });

  it("rejects unreviewed when certified is required", () => {
    const result = evaluateRoleRequirement(
      supplierInvoicePolicy.requiresEvidence[1]!,
      {
        role: "semantic_spend_validation",
        qualification: {
          provenance: "system-attested",
          definition: "unreviewed",
          freshness: {
            applicable: "applicable",
            snapshotFrozenAt: "2026-07-07T12:00:00.000Z",
            valueAsOf: "2026-07-07T11:58:00.000Z",
          },
        },
        providerId: "provider-json",
        conformanceSuiteVersion: "provider-conformance-0.1.0",
      },
    );
    expect(result.satisfied).toBe(false);
    expect(result.failures[0]?.code).toBe("definition_below_minimum");
  });

  it("evaluates freshness age against binding clock", () => {
    const result = evaluateRoleRequirement(
      {
        role: "telemetry",
        freshness: { applicable: "applicable", maxAgeMs: 60_000 },
      },
      {
        role: "telemetry",
        qualification: {
          provenance: "origin-attested",
          definition: "not-applicable",
          freshness: {
            applicable: "applicable",
            snapshotFrozenAt: "2026-07-07T12:05:00.000Z",
            valueAsOf: "2026-07-07T12:00:00.000Z",
          },
        },
        evaluatedAt: "2026-07-07T12:00:30.000Z",
      },
    );
    expect(result.satisfied).toBe(true);
  });

  it("evaluates full policy with missing role as failure", () => {
    const report = evaluateCanonPolicy(supplierInvoicePolicy, {});
    expect(report.satisfied).toBe(false);
    expect(report.roles).toHaveLength(2);
  });

  it("passes supplier invoice policy when roles meet floors", () => {
    const report = evaluateCanonPolicy(supplierInvoicePolicy, {
      source_invoice: {
        role: "source_invoice",
        qualification: {
          provenance: "system-attested",
          definition: "not-applicable",
          freshness: { applicable: "not-applicable" },
        },
      },
      semantic_spend_validation: {
        role: "semantic_spend_validation",
        qualification: {
          provenance: "system-attested",
          definition: "certified",
          freshness: {
            applicable: "applicable",
            snapshotFrozenAt: "2026-07-07T12:00:00.000Z",
            valueAsOf: "2026-07-07T11:58:00.000Z",
          },
        },
        providerId: "provider-json",
        conformanceSuiteVersion: "provider-conformance-0.1.0",
        evaluatedAt: "2026-07-07T12:00:00.000Z",
      },
    });
    expect(report.satisfied).toBe(true);
  });
});

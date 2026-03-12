// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { parseLoopYaml } from "../parser";
import { serializeToYaml } from "../serializer";

const validYaml = `
id: scm.procurement
version: 1.0.0
description: Procurement loop
domain: scm
states:
  - id: OPEN
  - id: CLOSED
    isTerminal: true
initialState: OPEN
transitions:
  - id: close
    from: OPEN
    to: CLOSED
    allowedActors: [human]
outcome:
  id: po_settled
  description: settled
  valueUnit: po_settled
  measurable: true
`;

describe("parseLoopYaml", () => {
  it("parses valid YAML definition", () => {
    const parsed = parseLoopYaml(validYaml);
    expect(parsed.id).toBe("scm.procurement");
  });

  it("rejects YAML with missing initialState", () => {
    const broken = validYaml.replace("initialState: OPEN", "");
    expect(() => parseLoopYaml(broken)).toThrow();
  });

  it("rejects YAML where transition references unknown state", () => {
    const broken = validYaml.replace("to: CLOSED", "to: MISSING");
    expect(() => parseLoopYaml(broken)).toThrow("transition.to references unknown state");
  });

  it("rejects YAML with invalid semver version", () => {
    const broken = validYaml.replace("version: 1.0.0", "version: v1");
    expect(() => parseLoopYaml(broken)).toThrow("version must be semver");
  });

  it("round-trip parse/serialize/parse stays equivalent", () => {
    const parsed = parseLoopYaml(validYaml);
    const reserialized = serializeToYaml(parsed);
    const reparsed = parseLoopYaml(reserialized);
    expect(reparsed.id).toBe(parsed.id);
    expect(reparsed.initialState).toBe(parsed.initialState);
  });
});

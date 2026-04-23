// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { parseLoopYaml, parseLoopYamlSafe } from "../parser";
import { serializeLoopYaml } from "../serializer";

const validYaml = `
id: support.ticket
version: 1.0.0
name: Support Ticket
description: Ticket handling loop
states:
  - id: OPEN
    label: Open
  - id: RESOLVED
    label: Resolved
    isTerminal: true
initialState: OPEN
transitions:
  - id: resolve
    from: OPEN
    to: RESOLVED
    signal: support.ticket.resolve
    actors: [human]
outcome:
  description: Ticket resolved
  valueUnit: ticket_resolution
  businessMetrics:
    - id: cycle_time_days
      label: Cycle time days
      unit: days
      improvableByAI: true
`;

describe("parseLoopYaml", () => {
  it("parses a valid YAML loop definition", () => {
    const parsed = parseLoopYaml(validYaml);
    expect(parsed.id).toBe("support.ticket");
  });

  it("throws on invalid YAML syntax", () => {
    const invalidYaml = "id: [unterminated";
    expect(() => parseLoopYaml(invalidYaml)).toThrow(/Invalid YAML syntax/);
  });

  it("throws on missing required field", () => {
    const missingInitialState = validYaml.replace("initialState: OPEN\n", "");
    expect(() => parseLoopYaml(missingInitialState)).toThrow(/initialState/);
  });

  it("parseLoopYamlSafe returns success false on invalid input", () => {
    const invalidYaml = "id: [unterminated";
    const result = parseLoopYamlSafe(invalidYaml);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("serializeLoopYaml round-trips through parseLoopYaml", () => {
    const parsed = parseLoopYaml(validYaml);
    const serialized = serializeLoopYaml(parsed);
    const reparsed = parseLoopYaml(serialized);
    expect(reparsed).toEqual(parsed);
  });
});

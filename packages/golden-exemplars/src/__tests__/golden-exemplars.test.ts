// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { LOADED_EXEMPLAR_IDS, loadGoldenExemplars } from "../index.js";

describe("golden exemplars (Set 0.5)", () => {
  it("loads all E01–E10 fixtures", () => {
    const rows = loadGoldenExemplars();
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.id)).toEqual([...LOADED_EXEMPLAR_IDS]);
  });
});

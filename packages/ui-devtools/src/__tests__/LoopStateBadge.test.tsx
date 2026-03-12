// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoopStateBadge } from "../components/LoopStateBadge";

describe("LoopStateBadge", () => {
  it("renders state label", () => {
    render(<LoopStateBadge state="OPEN" />);
    expect(screen.getByText("OPEN")).toBeDefined();
  });
});

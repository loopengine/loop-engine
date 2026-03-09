// @license MIT
// SPDX-License-Identifier: MIT
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoopStateBadge } from "../components/LoopStateBadge";

describe("LoopStateBadge", () => {
  it("renders state label", () => {
    render(<LoopStateBadge state="OPEN" />);
    expect(screen.getByText("OPEN")).toBeDefined();
  });
});

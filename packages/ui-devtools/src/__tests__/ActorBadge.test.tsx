// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActorBadge } from "../components/ActorBadge";

describe("ActorBadge", () => {
  it("renders actor type and id", () => {
    render(<ActorBadge actor={{ type: "human", id: "user@example.com" as never }} />);
    expect(screen.getByText(/human:user@example.com/)).toBeDefined();
  });
});

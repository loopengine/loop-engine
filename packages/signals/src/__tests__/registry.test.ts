// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SignalRegistry } from "../registry";

describe("SignalRegistry", () => {
  it("registers and retrieves a signal spec", () => {
    const registry = new SignalRegistry();
    registry.register({
      signalId: "support.ticket.resolve",
      name: "Resolve Ticket"
    });

    const spec = registry.get("support.ticket.resolve");
    expect(spec?.name).toBe("Resolve Ticket");
  });

  it("validates payload against schema when present", () => {
    const registry = new SignalRegistry();
    registry.register({
      signalId: "support.ticket.resolve",
      name: "Resolve Ticket",
      schema: z.object({ ticketId: z.string().min(1) })
    });

    expect(
      registry.validatePayload("support.ticket.resolve", { ticketId: "t-1" }).valid
    ).toBe(true);
    expect(
      registry.validatePayload("support.ticket.resolve", { ticketId: "" }).valid
    ).toBe(false);
  });

  it("returns invalid when signal is not registered", () => {
    const registry = new SignalRegistry();
    const result = registry.validatePayload("missing.signal", { any: "value" });
    expect(result.valid).toBe(false);
  });

  it("lists registered signal specs", () => {
    const registry = new SignalRegistry();
    registry.register({ signalId: "one", name: "One" });
    registry.register({ signalId: "two", name: "Two" });
    expect(registry.list()).toHaveLength(2);
  });
});

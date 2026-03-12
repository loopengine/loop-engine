// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { SignalId } from "@loop-engine/core";
import type { SignalSpec } from "./types";

export class SignalRegistry {
  private specs = new Map<SignalId, SignalSpec>();

  register(spec: SignalSpec): void {
    this.specs.set(spec.signalId, spec);
  }

  get(signalId: SignalId): SignalSpec | undefined {
    return this.specs.get(signalId);
  }

  validatePayload(signalId: SignalId, payload: unknown): { valid: boolean; error?: string } {
    const spec = this.specs.get(signalId);
    if (!spec) {
      return { valid: false, error: `Signal not registered: ${signalId}` };
    }

    if (!spec.schema) {
      return { valid: true };
    }

    const result = spec.schema.safeParse(payload);
    if (result.success) {
      return { valid: true };
    }

    const first = result.error.issues[0];
    if (!first) {
      return { valid: false, error: "Invalid payload" };
    }
    return {
      valid: false,
      error: `${first.path.join(".") || "payload"}: ${first.message}`
    };
  }

  list(): SignalSpec[] {
    return [...this.specs.values()];
  }
}

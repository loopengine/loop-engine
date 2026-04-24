// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * SR-016.5 unit tests for the classification surface. No container
 * required — these exercise pure logic against synthetic error shapes
 * to pin down the classification rule across every interesting input
 * category.
 *
 * Integration tests for the *withTransaction* side of error handling
 * (mid-tx connection loss → TransactionIntegrityError, constraint
 * violations passing through, etc.) live in `transactions.test.ts`
 * where a real Postgres container is available.
 */

import { describe, expect, it } from "vitest";

import {
  classifyError,
  isTransientError,
  PostgresStoreError,
  TransactionIntegrityError
} from "../errors";

describe("classifyError", () => {
  describe("Postgres SQLSTATE codes", () => {
    it("classifies 40P01 (deadlock_detected) as transient", () => {
      expect(classifyError({ code: "40P01", message: "deadlock" })).toBe(
        "transient"
      );
    });

    it("classifies 57P01 (admin_shutdown) as transient", () => {
      expect(classifyError({ code: "57P01", message: "admin shutdown" })).toBe(
        "transient"
      );
    });

    it("classifies 57P02 (crash_shutdown) as transient", () => {
      expect(classifyError({ code: "57P02", message: "crash" })).toBe("transient");
    });

    it("classifies 57P03 (cannot_connect_now) as transient", () => {
      expect(classifyError({ code: "57P03", message: "starting up" })).toBe(
        "transient"
      );
    });

    it("classifies 23505 (unique_violation) as permanent", () => {
      expect(
        classifyError({ code: "23505", message: "duplicate key" })
      ).toBe("permanent");
    });

    it("classifies 23503 (foreign_key_violation) as permanent", () => {
      expect(
        classifyError({ code: "23503", message: "foreign key" })
      ).toBe("permanent");
    });

    it("classifies 42P01 (undefined_table) as permanent", () => {
      expect(
        classifyError({ code: "42P01", message: "no such table" })
      ).toBe("permanent");
    });

    it("classifies 22P02 (invalid_text_representation) as permanent", () => {
      expect(
        classifyError({ code: "22P02", message: "invalid input syntax" })
      ).toBe("permanent");
    });

    it("classifies 40001 (serialization_failure) as permanent at RC (not yet supported)", () => {
      // Documented exclusion: the adapter doesn't ship a SERIALIZABLE
      // opt-in yet, so we don't pre-declare 40001 as transient. Add
      // when the isolation-level surface lands.
      expect(
        classifyError({ code: "40001", message: "serialization failure" })
      ).toBe("permanent");
    });
  });

  describe("Node connection error codes", () => {
    it("classifies ECONNRESET as transient", () => {
      expect(classifyError({ code: "ECONNRESET", message: "reset" })).toBe(
        "transient"
      );
    });

    it("classifies ECONNREFUSED as transient", () => {
      expect(
        classifyError({ code: "ECONNREFUSED", message: "refused" })
      ).toBe("transient");
    });

    it("classifies ETIMEDOUT as transient", () => {
      expect(classifyError({ code: "ETIMEDOUT", message: "timeout" })).toBe(
        "transient"
      );
    });

    it("classifies ENOTFOUND as transient", () => {
      expect(classifyError({ code: "ENOTFOUND", message: "dns" })).toBe(
        "transient"
      );
    });

    it("classifies EHOSTUNREACH as transient", () => {
      expect(
        classifyError({ code: "EHOSTUNREACH", message: "unreachable" })
      ).toBe("transient");
    });

    it("classifies ENETUNREACH as transient", () => {
      expect(
        classifyError({ code: "ENETUNREACH", message: "net unreachable" })
      ).toBe("transient");
    });
  });

  describe("pg connection-terminated messages (no code)", () => {
    it("matches 'Connection terminated unexpectedly' as transient", () => {
      expect(
        classifyError(new Error("Connection terminated unexpectedly"))
      ).toBe("transient");
    });

    it("matches 'Connection ended unexpectedly' as transient", () => {
      expect(
        classifyError(new Error("Connection ended unexpectedly"))
      ).toBe("transient");
    });

    it("is case-insensitive", () => {
      expect(
        classifyError(new Error("connection terminated"))
      ).toBe("transient");
    });
  });

  describe("PostgresStoreError instances", () => {
    it("returns the instance's own kind", () => {
      const err = new PostgresStoreError("some failure", { kind: "permanent" });
      expect(classifyError(err)).toBe("permanent");
    });

    it("TransactionIntegrityError is always transient", () => {
      const err = new TransactionIntegrityError("indeterminate");
      expect(classifyError(err)).toBe("transient");
    });

    it("classifies a kind-less PostgresStoreError via the cause", () => {
      const cause = { code: "23505", message: "duplicate" };
      const err = new PostgresStoreError("wrap", { cause });
      expect(err.kind).toBe("permanent");
      expect(classifyError(err)).toBe("permanent");
    });
  });

  describe("edge cases", () => {
    it("returns 'unknown' for null / undefined", () => {
      expect(classifyError(null)).toBe("unknown");
      expect(classifyError(undefined)).toBe("unknown");
    });

    it("returns 'unknown' for primitives", () => {
      expect(classifyError("string error")).toBe("unknown");
      expect(classifyError(42)).toBe("unknown");
    });

    it("returns 'unknown' for errors with neither code nor matching message", () => {
      expect(classifyError(new Error("some random failure"))).toBe("unknown");
    });

    it("returns 'unknown' for non-SQLSTATE-shaped code strings", () => {
      // "ABC" is 3 chars, doesn't match SQLSTATE shape — treat as
      // unknown rather than permanent to avoid misclassifying custom
      // error shapes from test doubles or library wrappers.
      expect(classifyError({ code: "ABC", message: "custom" })).toBe("unknown");
    });

    it("returns 'unknown' for non-string code fields", () => {
      expect(classifyError({ code: 23505, message: "numeric code" })).toBe(
        "unknown"
      );
    });
  });
});

describe("isTransientError", () => {
  it("mirrors classifyError === 'transient'", () => {
    expect(isTransientError({ code: "40P01" })).toBe(true);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError({ code: "23505" })).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(new TransactionIntegrityError("x"))).toBe(true);
  });
});

describe("PostgresStoreError construction", () => {
  it("preserves cause and classifies kind from it when kind is unset", () => {
    const cause = new Error("Connection terminated unexpectedly");
    const err = new PostgresStoreError("wrap", { cause });
    expect(err.cause).toBe(cause);
    expect(err.kind).toBe("transient");
    expect(err.message).toBe("wrap");
    expect(err.name).toBe("PostgresStoreError");
  });

  it("honors explicit kind over cause-derived classification", () => {
    const cause = { code: "23505" }; // would classify as permanent
    const err = new PostgresStoreError("override", {
      cause,
      kind: "unknown"
    });
    expect(err.kind).toBe("unknown");
  });

  it("TransactionIntegrityError locks kind to transient regardless of cause", () => {
    const permanentCause = { code: "23505", message: "duplicate" };
    const err = new TransactionIntegrityError("indeterminate", {
      cause: permanentCause
    });
    expect(err.kind).toBe("transient");
    expect(err.cause).toBe(permanentCause);
    expect(err.name).toBe("TransactionIntegrityError");
    expect(err).toBeInstanceOf(PostgresStoreError);
  });

  it("works with no options", () => {
    const err = new PostgresStoreError("bare");
    expect(err.cause).toBeUndefined();
    expect(err.kind).toBe("unknown"); // classifyError(undefined) === "unknown"
  });
});

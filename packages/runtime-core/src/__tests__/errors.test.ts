// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";

import { err401, err403, err404, err422, err429, err503 } from "../errors.js";

async function readBody(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

describe("error envelope factories", () => {
  it("err401 returns status 401 with default message", async () => {
    const res = err401();
    expect(res.status).toBe(401);
    expect(await readBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("err403 / err404 surface the supplied message", async () => {
    expect((await readBody(err403("Nope"))).error).toBe("Nope");
    expect((await readBody(err404("Run not found"))).error).toBe("Run not found");
  });

  it("err422 includes the fields object when provided", async () => {
    const res = err422("Bad query", { category: "must be provider|channel|integration|protocol" });
    expect(res.status).toBe(422);
    const body = await readBody(res);
    expect(body).toEqual({
      error: "Bad query",
      fields: { category: "must be provider|channel|integration|protocol" },
    });
  });

  it("err429 sets Retry-After: 60", () => {
    const res = err429();
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("err503 sets Retry-After: 30 and 503 status", () => {
    const res = err503("Trace API disabled");
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});

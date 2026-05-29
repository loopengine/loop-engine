import { describe, expect, it } from "vitest";

import { createMetadataConnectionsHandler } from "../metadata-connections.js";

async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

type Catalog = {
  contractVersion: string;
  catalogVersion: string;
  connections: Array<{ category: string }>;
};

describe("createMetadataConnectionsHandler", () => {
  it("returns 200 with the RT-11 contract envelope", async () => {
    const handler = createMetadataConnectionsHandler();
    const res = await handler(new Request("http://localhost:3012/api/v1/metadata/connections"));
    expect(res.status).toBe(200);
    const body = await readJson<Catalog>(res);
    expect(body.contractVersion).toBe("runtime-api-2026-05");
    expect(body.catalogVersion).toBe("1.0.0");
    expect(body.connections.length).toBeGreaterThan(0);
  });

  it("filters by category when ?category= is supplied", async () => {
    const handler = createMetadataConnectionsHandler();
    const res = await handler(
      new Request("http://localhost:3012/api/v1/metadata/connections?category=channel"),
    );
    const body = await readJson<Catalog>(res);
    for (const c of body.connections) expect(c.category).toBe("channel");
  });

  it("returns 422 with fields.category when ?category= is invalid", async () => {
    const handler = createMetadataConnectionsHandler();
    const res = await handler(
      new Request("http://localhost:3012/api/v1/metadata/connections?category=widgets"),
    );
    expect(res.status).toBe(422);
    const body = await readJson<{ error: string; fields: { category: string } }>(res);
    expect(body.error).toBe("Invalid query parameter");
    expect(body.fields.category).toContain("provider");
  });
});

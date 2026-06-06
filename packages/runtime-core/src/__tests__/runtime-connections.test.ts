// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";

import {
  buildMetadataConnectionsResponse,
  getRuntimeConnectionCatalog,
  isRuntimeConnectionCategory,
  listRuntimeConnections,
  parseRuntimeConnectionCategory,
} from "../runtime-connections/index.js";

describe("runtime-connections catalog", () => {
  it("loads the bundled catalog with a contract-stable version", () => {
    const cat = getRuntimeConnectionCatalog();
    expect(cat.catalogVersion).toBe("1.0.0");
    expect(cat.connections.length).toBeGreaterThan(0);
    expect(cat.connections.some((c) => c.id === "channel.slack")).toBe(true);
    expect(cat.connections.some((c) => c.id === "integration.google_sheets")).toBe(true);
  });

  it("filters by category", () => {
    const channels = listRuntimeConnections("channel");
    expect(channels.length).toBeGreaterThan(0);
    for (const c of channels) {
      expect(c.category).toBe("channel");
    }
  });

  it("returns the full catalog when no category is provided", () => {
    const all = listRuntimeConnections();
    const cat = getRuntimeConnectionCatalog();
    expect(all.length).toBe(cat.connections.length);
  });
});

describe("parseRuntimeConnectionCategory", () => {
  it("returns null for empty / null input", () => {
    expect(parseRuntimeConnectionCategory(null)).toBeNull();
    expect(parseRuntimeConnectionCategory("")).toBeNull();
    expect(parseRuntimeConnectionCategory("   ")).toBeNull();
  });

  it("normalizes case", () => {
    expect(parseRuntimeConnectionCategory("CHANNEL")).toBe("channel");
  });

  it("returns 'invalid' sentinel for unknown categories so the route maps to 422", () => {
    expect(parseRuntimeConnectionCategory("widgets")).toBe("invalid");
  });
});

describe("isRuntimeConnectionCategory", () => {
  it("recognizes the four locked categories", () => {
    for (const c of ["provider", "channel", "integration", "protocol"]) {
      expect(isRuntimeConnectionCategory(c)).toBe(true);
    }
    expect(isRuntimeConnectionCategory("notice")).toBe(false);
  });
});

describe("buildMetadataConnectionsResponse", () => {
  it("includes contractVersion + catalogVersion + filtered connections", () => {
    const res = buildMetadataConnectionsResponse("integration");
    expect(res.contractVersion).toBe("runtime-api-2026-05");
    expect(res.catalogVersion).toBe("1.0.0");
    for (const c of res.connections) expect(c.category).toBe("integration");
  });
});

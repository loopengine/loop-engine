// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loopId } from "@loop-engine/core";
import { parseLoopYaml } from "@loop-engine/dsl";
import { localRegistry } from "../adapters/local";
import { RegistryConflictError } from "../types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");

async function loadFixture(relativePath: string) {
  const fullPath = path.join(repoRoot, relativePath);
  const content = await readFile(fullPath, "utf8");
  return parseLoopYaml(content);
}

describe("localRegistry — in-memory mode", () => {
  it("should register and retrieve a loop definition", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const registry = localRegistry({ definitions: [procurement] });
    const found = await registry.get(loopId("scm.procurement"));
    expect(found?.id).toBe(loopId("scm.procurement"));
  });

  it("should return null for unknown loop ids", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const registry = localRegistry({ definitions: [procurement] });
    const found = await registry.get(loopId("unknown.loop"));
    expect(found).toBeNull();
  });

  it("should list all definitions", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const replenishment = await loadFixture("loops/scm/replenishment.yaml");
    const registry = localRegistry({ definitions: [procurement, replenishment] });
    const listed = await registry.list();
    expect(listed).toHaveLength(2);
  });

  it("should filter list by domain", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const leadQualification = await loadFixture("loops/crm/lead-qualification.yaml");
    const registry = localRegistry({ definitions: [procurement, leadQualification] });
    const listed = await registry.list({ domain: "scm" });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.domain).toBe("scm");
  });

  it("should throw RegistryConflictError on duplicate id+version", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const registry = localRegistry({ definitions: [procurement] });
    await expect(registry.register(procurement)).rejects.toBeInstanceOf(RegistryConflictError);
  });

  it("should allow overwrite with force: true", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const registry = localRegistry({ definitions: [procurement] });
    const overwritten = { ...procurement, description: "Updated description" };
    await registry.register(overwritten, { force: true });
    const found = await registry.get(loopId("scm.procurement"));
    expect(found?.description).toBe("Updated description");
  });

  it("should remove a definition", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const registry = localRegistry({ definitions: [procurement] });
    const removed = await registry.remove(loopId("scm.procurement"));
    expect(removed).toBe(true);
    const found = await registry.get(loopId("scm.procurement"));
    expect(found).toBeNull();
  });
});

describe("localRegistry — directory mode", () => {
  it("should load .yaml files from a directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-yaml-"));
    const procurementYaml = await readFile(path.join(repoRoot, "loops/scm/procurement.yaml"), "utf8");
    await writeFile(path.join(dir, "procurement.yaml"), procurementYaml, "utf8");

    const registry = localRegistry({ loopsDir: dir });
    const found = await registry.get(loopId("scm.procurement"));
    expect(found?.id).toBe(loopId("scm.procurement"));
  });

  it("should load .json files from a directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-json-"));
    const replenishment = await loadFixture("loops/scm/replenishment.yaml");
    await writeFile(path.join(dir, "replenishment.json"), JSON.stringify(replenishment), "utf8");

    const registry = localRegistry({ loopsDir: dir });
    const found = await registry.get(loopId("scm.replenishment"));
    expect(found?.id).toBe(loopId("scm.replenishment"));
  });

  it("should silently ignore non-yaml/json files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-ignore-"));
    await writeFile(path.join(dir, "README.txt"), "ignore me", "utf8");
    const registry = localRegistry({ loopsDir: dir });
    const listed = await registry.list();
    expect(listed).toHaveLength(0);
  });

  it("should set source as 'local' on loaded entries", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-source-"));
    const procurementYaml = await readFile(path.join(repoRoot, "loops/scm/procurement.yaml"), "utf8");
    await writeFile(path.join(dir, "procurement.yaml"), procurementYaml, "utf8");

    const registry = localRegistry({ loopsDir: dir }) as {
      get(id: ReturnType<typeof loopId>): Promise<unknown>;
      __getEntry(id: ReturnType<typeof loopId>): { source: string } | undefined;
    };
    await registry.get(loopId("scm.procurement"));
    expect(registry.__getEntry(loopId("scm.procurement"))?.source).toBe("local");
  });
});

describe("localRegistry — convenience array constructor", () => {
  it("should accept LoopDefinition[] directly as first argument", async () => {
    const procurement = await loadFixture("loops/scm/procurement.yaml");
    const registry = localRegistry([procurement]);
    const found = await registry.get(loopId("scm.procurement"));
    expect(found?.id).toBe(loopId("scm.procurement"));
  });
});

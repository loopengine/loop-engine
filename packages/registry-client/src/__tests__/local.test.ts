// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LoopDefinitionSchema, type LoopDefinition } from "@loop-engine/core";
import { serializeLoopYaml } from "@loop-engine/dsl";
import { localRegistry } from "../adapters/local";
import { RegistryConflictError } from "../types";

const asLoopId = (id: string) => id as never;

function makeLoop(id: string): LoopDefinition {
  return LoopDefinitionSchema.parse({
    loopId: id,
    version: "1.0.0",
    name: id,
    description: `${id} description`,
    states: [
      { stateId: "OPEN", label: "Open" },
      { stateId: "DONE", label: "Done", terminal: true }
    ],
    initialState: "OPEN",
    transitions: [
      {
        transitionId: "finish",
        from: "OPEN",
        to: "DONE",
        signal: `${id}.finish`,
        allowedActors: ["human"]
      }
    ],
    outcome: {
      description: "Done",
      valueUnit: "done",
      businessMetrics: [{ id: "cycle_time_days", label: "Cycle Time", unit: "days" }]
    }
  });
}

describe("localRegistry — in-memory mode", () => {
  it("should register and retrieve a loop definition", async () => {
    const definition = makeLoop("scm.procurement");
    const registry = localRegistry({ definitions: [definition] });
    const found = await registry.get(asLoopId("scm.procurement"));
    expect(found?.loopId).toBe(asLoopId("scm.procurement"));
  });

  it("should return null for unknown loop ids", async () => {
    const registry = localRegistry({ definitions: [makeLoop("scm.procurement")] });
    const found = await registry.get(asLoopId("unknown.loop"));
    expect(found).toBeNull();
  });

  it("should list all definitions", async () => {
    const registry = localRegistry({
      definitions: [makeLoop("scm.procurement"), makeLoop("scm.replenishment")]
    });
    const listed = await registry.list();
    expect(listed).toHaveLength(2);
  });

  it("should filter list by domain", async () => {
    const registry = localRegistry({
      definitions: [makeLoop("scm.procurement"), makeLoop("crm.lead-qualification")]
    });
    const listed = await registry.list({ domain: "scm" });
    expect(listed).toHaveLength(1);
    expect(String(listed[0]?.loopId).startsWith("scm.")).toBe(true);
  });

  it("should throw RegistryConflictError on duplicate id+version", async () => {
    const definition = makeLoop("scm.procurement");
    const registry = localRegistry({ definitions: [definition] });
    await expect(registry.register(definition)).rejects.toBeInstanceOf(RegistryConflictError);
  });

  it("should allow overwrite with force: true", async () => {
    const registry = localRegistry({ definitions: [makeLoop("scm.procurement")] });
    const overwritten = { ...makeLoop("scm.procurement"), description: "Updated description" };
    await registry.register(overwritten, { force: true });
    const found = await registry.get(asLoopId("scm.procurement"));
    expect(found?.description).toBe("Updated description");
  });

  it("should remove a definition", async () => {
    const registry = localRegistry({ definitions: [makeLoop("scm.procurement")] });
    const removed = await registry.remove(asLoopId("scm.procurement"));
    expect(removed).toBe(true);
    const found = await registry.get(asLoopId("scm.procurement"));
    expect(found).toBeNull();
  });
});

describe("localRegistry — directory mode", () => {
  it("should load .yaml files from a directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-yaml-"));
    const yaml = serializeLoopYaml(makeLoop("scm.procurement"));
    await writeFile(path.join(dir, "procurement.yaml"), yaml, "utf8");

    const registry = localRegistry({ loopsDir: dir });
    const found = await registry.get(asLoopId("scm.procurement"));
    expect(found?.loopId).toBe(asLoopId("scm.procurement"));
  });

  it("should load .json files from a directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "loopengine-reg-json-"));
    const replenishment = makeLoop("scm.replenishment");
    await writeFile(path.join(dir, "replenishment.json"), JSON.stringify(replenishment), "utf8");

    const registry = localRegistry({ loopsDir: dir });
    const found = await registry.get(asLoopId("scm.replenishment"));
    expect(found?.loopId).toBe(asLoopId("scm.replenishment"));
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
    const yaml = serializeLoopYaml(makeLoop("scm.procurement"));
    await writeFile(path.join(dir, "procurement.yaml"), yaml, "utf8");

    const registry = localRegistry({ loopsDir: dir }) as {
      get(id: ReturnType<typeof asLoopId>): Promise<unknown>;
      __getEntry(id: ReturnType<typeof asLoopId>): { source: string } | undefined;
    };
    await registry.get(asLoopId("scm.procurement"));
    expect(registry.__getEntry(asLoopId("scm.procurement"))?.source).toBe("local");
  });
});

describe("localRegistry — convenience array constructor", () => {
  it("should accept LoopDefinition[] directly as first argument", async () => {
    const registry = localRegistry([makeLoop("scm.procurement")]);
    const found = await registry.get(asLoopId("scm.procurement"));
    expect(found?.loopId).toBe(asLoopId("scm.procurement"));
  });
});

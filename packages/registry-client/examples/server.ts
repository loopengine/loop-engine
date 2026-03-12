// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
// npm install express to run this example
import express from "express";
import { localRegistry } from "../src";

const app = express();
app.use(express.json());

// In-memory registry (swap with a real store for production)
const registry = localRegistry();

// GET /loops — list all, optional ?domain= filter
app.get("/loops", async (req, res) => {
  const domain = req.query.domain as string | undefined;
  const loops = await registry.list(domain ? { domain } : undefined);
  res.json(loops);
});

// GET /loops/:loopId — get by id
app.get("/loops/:loopId", async (req, res) => {
  const loop = await registry.get(req.params.loopId as never);
  if (!loop) return res.status(404).json({ error: "Loop not found" });
  res.json(loop);
});

// GET /loops/:loopId/:version — get specific version
app.get("/loops/:loopId/:version", async (req, res) => {
  const loop = await registry.getVersion(req.params.loopId as never, req.params.version);
  if (!loop) return res.status(404).json({ error: "Loop version not found" });
  res.json(loop);
});

// POST /loops — register
app.post("/loops", async (req, res) => {
  const force = req.query.force === "true";
  try {
    await registry.register(req.body, { force });
    res.status(201).json({ registered: true });
  } catch (err: any) {
    if (err?.name === "RegistryConflictError") {
      return res.status(409).json({ error: err.message });
    }
    res.status(400).json({ error: err?.message ?? "Invalid loop definition" });
  }
});

// DELETE /loops/:loopId — remove
app.delete("/loops/:loopId", async (req, res) => {
  const removed = await registry.remove(req.params.loopId as never);
  if (!removed) return res.status(404).json({ error: "Loop not found" });
  res.status(204).end();
});

app.listen(3001, () => {
  console.log("Loop registry server running on http://localhost:3001");
});

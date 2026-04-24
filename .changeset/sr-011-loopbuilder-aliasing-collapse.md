---
"@loop-engine/core": major
"@loop-engine/runtime": major
"@loop-engine/sdk": major
"@loop-engine/actors": major
"@loop-engine/guards": major
"@loop-engine/loop-definition": major
"@loop-engine/events": major
"@loop-engine/signals": major
"@loop-engine/observability": major
"@loop-engine/registry-client": major
"@loop-engine/ui-devtools": major
"@loop-engine/adapter-memory": major
"@loop-engine/adapter-vercel-ai": major
"@loop-engine/adapter-perplexity": major
"@loop-engine/adapter-anthropic": major
"@loop-engine/adapter-openai": major
"@loop-engine/adapter-gemini": major
"@loop-engine/adapter-grok": major
"@loop-engine/adapter-http": major
"@loop-engine/adapter-openclaw": major
"@loop-engine/adapter-pagerduty": major
"@loop-engine/adapter-commerce-gateway": major
---
## SR-011 · D-05 · `LoopBuilder` aliasing layer collapse (MECHANICAL 8.12)

**Class.** Class 2 (interface change — removes `LoopBuilderGuardLegacy` / `LoopBuilderGuardShorthand` type union, `ACTOR_ALIASES` string-form-alias map, and the guard-input legacy/shorthand discriminator from `LoopBuilder`'s authoring surface).

**Scope.** `packages/loop-definition/src/builder.ts` simplified per the resolution log's cross-cutting consequence (`D-05 + D-07 collapse the LoopBuilder aliasing layer`). With source field names matching consumption-layer conventions post-SR-010, the bridging logic is no longer needed. Changes:

- **Removed:** `LoopBuilderGuardLegacy`, `LoopBuilderGuardShorthand`, and the discriminating `LoopBuilderGuardInput` union they formed; `isGuardLegacy` discriminator; `ACTOR_ALIASES` map (`ai_agent → ai-agent`, `system → system`); `normalizeActorType` function.
- **Simplified:** `LoopBuilderGuardInput` is now a single canonical shape — `Omit<GuardSpec, "id"> & { id: string }` — where `id` stays plain string for authoring ergonomics and the builder brand-casts to `GuardSpec["id"]` during normalization. `normalizeGuard` is a single pass-through that applies the brand cast; the legacy/shorthand split is gone.
- **Tightened:** `LoopBuilderTransitionInput.actors` is now typed as `ActorType[]` (was `string[]`). The `ai_agent` underscore alias is no longer accepted at the authoring surface — authors must use the canonical `"ai-agent"` dash form. Docs and examples already use the canonical form (e.g., `examples/ai-actors/shared/loop.ts`), so no example-side follow-up needed.

**Retained:** The `signal := transition.id` defaulting in `normalizeTransitions` is explicitly preserved as a defensive boundary marker for PB-EX-05 Option B. Per the post-SR-010 enforcement-site amendment, the canonical enforcement site is the `.transform()` on `TransitionSpecSchema`; this pre-fill is idempotent against that transform and is retained so the authoring→runtime boundary remains explicit at the authoring surface. Not part of the collapsed aliasing layer.

**Barrel re-exports updated:**

- `packages/loop-definition/src/index.ts` — drops `LoopBuilderGuardLegacy` / `LoopBuilderGuardShorthand` type re-exports; retains `LoopBuilderGuardInput` (now the single canonical shape).
- `packages/sdk/src/index.ts` — same drop; retains `LoopBuilderGuardInput`.

**Migration.**

```diff
  // Actor strings — canonical dash form only:
- .transition({ id: "go", from: "A", to: "B", actors: ["ai_agent", "human"] })
+ .transition({ id: "go", from: "A", to: "B", actors: ["ai-agent", "human"] })

  // Guards — canonical GuardSpec shape only (no `type` / `minimum` shorthand):
- guards: [{ id: "confidence_check", type: "confidence_threshold", minimum: 0.85 }]
+ guards: [
+   {
+     id: "confidence_check",
+     severity: "hard",
+     evaluatedBy: "external",
+     description: "AI confidence threshold gate",
+     parameters: { type: "confidence_threshold", minimum: 0.85 }
+   }
+ ]

  // Removed type imports:
- import type { LoopBuilderGuardLegacy, LoopBuilderGuardShorthand } from "@loop-engine/sdk";
+ // Use LoopBuilderGuardInput — the single canonical shape.
```

**Out of scope for this row (intentionally):**

- ID factory functions (`loopId(s)`, `stateId(s)`, etc.) — D-01, lands in SR-012.
- D-13 AI provider adapter re-homing — Phase A.3 row, lands in SR-013 after PB-EX-02 / PB-EX-03 adjudication.
- External `loop-examples` repo migration (if any author used the removed shorthand forms externally) — Branch C work.

**Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean; workspace `pnpm -r typecheck` green; workspace `pnpm -r test` green (143/143 tests pass — same count as SR-010; the two tests that exercised the removed aliases were updated to canonical forms, not removed); d.ts surface diff confirms `LoopBuilderGuardLegacy`, `LoopBuilderGuardShorthand`, and `ACTOR_ALIASES` are absent from both `packages/loop-definition/dist/index.d.ts` and `packages/sdk/dist/index.d.ts`; `LoopBuilderGuardInput` reflects the single canonical shape. Tarball sizes: `@loop-engine/loop-definition` shrinks from 25.6 KB → 17.6 KB packed (121.3 KB → 116.5 KB unpacked); `@loop-engine/sdk` shrinks from 14.2 KB → 14.1 KB packed (71.7 KB → 71.5 KB unpacked). Other packages unchanged.

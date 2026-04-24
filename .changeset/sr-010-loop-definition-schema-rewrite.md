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
## SR-010 · D-05 · `LoopDefinition` / `StateSpec` / `TransitionSpec` / `GuardSpec` / `OutcomeSpec` schema rewrite (MECHANICAL 8.11)

**Class.** Class 2 (interface change — field renames, constraint relaxation, additive fields across the five primary spec schemas; consumer cascade across runtime, validator, serializer, registry adapters, scripts, tests, and apps).

**Scope.** `packages/core/src/schemas.ts` rewritten to canonical D-05 shape. Cascades:
- `@loop-engine/core` — schema rewrite + types.
- `@loop-engine/loop-definition` — builder normalize, validator field accesses, serializer field mapping, parser/applyAuthoringDefaults helper retained as public marker.
- `@loop-engine/registry-client` — local + http adapters: `definition.id` reads, defensive `applyAuthoringDefaults` calls retained.
- `@loop-engine/runtime` — engine field reads on `StateSpec`/`TransitionSpec`/`GuardSpec`; `LoopInstance.loopId` runtime field unchanged per layered contract.
- `@loop-engine/actors` — `transition.actors` + `transition.id`.
- `@loop-engine/guards` — `guard.id`.
- `@loop-engine/adapter-vercel-ai` — `definition.id` + `transition.id`.
- `@loop-engine/observability` — `transition.id` in replay match logic.
- `@loop-engine/sdk` — `InMemoryLoopRegistry.get` + `mergeDefinitions` use `definition.id`.
- `@loop-engine/events` — `LoopDefinitionLike` Pick uses `id` (its consumer `extractLearningSignal` accesses `name` / `outcome` only; `LoopStartedEvent.definition` payload remains `loopId` per runtime-layer invariant).
- `@loop-engine/ui-devtools` — `StateDiagram.tsx` field reads.
- `apps/playground` — `definition.id` + `t.id` reads.
- `scripts/validate-loops.ts` — explicit normalize maps old → new names; explicit PB-EX-05 boundary-default note in code.
- All schema-construction tests across the workspace updated to new field names; runtime-layer test inputs (`LoopInstance.loopId`, `TransitionRecord.transitionId`, `LoopStartedEvent.definition.loopId`, `StartLoopParams.loopId`, `TransitionParams.transitionId`) intentionally left unchanged per layered contract.

**Rename map (authoring layer only — runtime fields are preserved):**

```diff
  // LoopDefinition
- loopId: LoopId
+ id: LoopId
+ domain?: string                      // additive

  // StateSpec
- stateId: StateId
+ id: StateId
- terminal?: boolean
+ isTerminal?: boolean
+ isError?: boolean                    // additive

  // TransitionSpec
- transitionId: TransitionId
+ id: TransitionId
- allowedActors: ActorType[]
+ actors: ActorType[]
- signal: SignalId                     // required (authoring)
+ signal?: SignalId                    // optional at authoring; required at runtime via boundary defaulting (PB-EX-05 Option B)

  // GuardSpec
- guardId: GuardId
+ id: GuardId
+ failureMessage?: string              // additive

  // OutcomeSpec
+ id?: OutcomeId                       // additive (consumes D-02 brand from SR-009)
+ measurable?: boolean                 // additive
```

**PB-EX-05 Option B implementation note (boundary-defaulting contract).** The D-05 extension specifies the layered contract: `TransitionSpec.signal` is optional at the authoring layer; downstream runtime consumers (`TransitionRecord.signal`, validator uniqueness check, engine event-stream construction) operate on `signal: SignalId` invariantly. The original D-05 extension named two enforcement sites — `LoopBuilder.build()` (existing pre-fill) and parser-wrapper `applyAuthoringDefaults` calls (post-parse). This SR implements the contract via a **schema-level `.transform()` on `TransitionSpecSchema`** that fills `signal := id` whenever authored `signal` is absent, so the OUTPUT type (`z.infer<typeof TransitionSpecSchema>`, exported as `TransitionSpec`) has `signal: SignalId` required. This:
- Honors the resolution's runtime-no-modification promise — engine.ts:205, 219, 302, 329 typecheck without per-site `??` fallbacks because the inferred type already encodes the post-default invariant.
- Subsumes both originally-named enforcement sites (LoopBuilder pre-fill is now defensive but idempotent; parser-wrapper / registry-adapter `applyAuthoringDefaults` calls are retained as public markers but idempotent given the in-schema transform).
- Preserves the two-layer authoring/runtime distinction at the type level: `z.input<typeof TransitionSpecSchema>` has `signal?` optional (authoring INPUT); `z.infer<typeof TransitionSpecSchema>` has `signal` required (runtime OUTPUT after parse).

This implementation choice is a **superset of the original D-05 extension's two named sites** — same contract, single enforcement point inside the schema rather than scattered across consumer-side boundaries. Operator may choose to ratify the implementation as a refinement of PB-EX-05's enforcement strategy; no contract semantics are changed.

**PB-EX-06 Option A confirmation.** Phase A.3 row order followed (D-02 brands landed in SR-009 before this SR-010 schema rewrite). `OutcomeSpec.id?: OutcomeId` resolves cleanly against the `OutcomeId` brand added in SR-009.

**Migration.**

```diff
  // Authoring layer (loop definitions / YAML / JSON / DSL):
  const loop = LoopDefinitionSchema.parse({
-   loopId: "support.ticket",
+   id: "support.ticket",
    states: [
-     { stateId: "OPEN", label: "Open" },
-     { stateId: "DONE", label: "Done", terminal: true }
+     { id: "OPEN", label: "Open" },
+     { id: "DONE", label: "Done", isTerminal: true }
    ],
    transitions: [
      {
-       transitionId: "finish",
-       allowedActors: ["human"],
+       id: "finish",
+       actors: ["human"],
        // signal: "demo.finish"   ← now optional; defaults to transition.id when omitted
      }
    ]
  });

  // Runtime layer (UNCHANGED by D-05):
  // - LoopInstance.loopId                    — runtime field
  // - TransitionRecord.transitionId          — runtime field
  // - StartLoopParams.loopId                 — runtime parameter
  // - TransitionParams.transitionId          — runtime parameter
  // - LoopStartedEvent.definition.loopId     — event payload (event-stream invariant)
  // - GuardEvaluationResult.guardId          — runtime evaluation result
```

**Out of scope for this row (intentionally):**

- LoopBuilder aliasing layer collapse (MECHANICAL 8.12) — separate Phase A.3 row, lands in SR-011.
- ID factory functions (`loopId(s)`, `stateId(s)`, etc.) — D-01, lands in SR-012.
- D-13 AI provider adapter re-homing — Phase A.3 row, lands in SR-013 after PB-EX-02 / PB-EX-03 adjudication.
- In-tree examples field-name updates — Phase A.6 follow-up (no in-tree examples touched in this SR).
- External `loop-examples` repo updates — Branch C work.
- Docs prose updates referencing old field names — Branch B work.

**Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean (no stale symlinks repaired this SR); workspace `pnpm -r typecheck` green (26/26 packages); workspace `pnpm -r test` green (143/143 tests pass); d.ts surface diff confirms new field names + transformed `TransitionSpec` output type with `signal` required; tarball sizes within bounds (core: 16.7 KB packed / 98.1 KB unpacked; sdk: 14.2 KB / 71.7 KB; runtime: 13.0 KB / 85.6 KB; loop-definition: 25.6 KB / 121.3 KB; registry-client: 19.9 KB / 135.3 KB).

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
## SR-015 · R-164 + R-186 · SDK barrel hygiene + single-root exports

**What landed.** Three `loop-engine` commits under
`Surface-Reconciliation-Id: SR-015`:

- `dbeceda` — `refactor(sdk): rewrite barrel per publish hygiene
  (R-164)`. The `@loop-engine/sdk` root barrel now uses explicit
  named re-exports instead of `export *`. Class 3 pre/post d.ts
  diff gate cleared: 158 → 151 public symbols, every delta
  accounted for.
- `d0d2642` — `fix(adapter-vercel-ai): apply missed D-01/D-05
  field renames in loop-tool-bridge`. Bycatch procedural fix for
  a pre-existing D-05 cascade miss that was silently masked in
  prior SRs (see "Procedural finding" below). Internal source
  fix only; no consumer-visible API change except that
  `@loop-engine/adapter-vercel-ai`'s `dist/index.d.ts` now
  emits correctly for the first time post-D-05.
- `bd23e2a` — `chore(packages): enforce single root export per
  D-21 (R-186)`. Drops `@loop-engine/sdk/dsl` subpath; migrates
  the single in-tree consumer (`apps/playground`) to import
  from `@loop-engine/loop-definition` directly.

**Breaking changes for `@loop-engine/sdk` consumers.**

1. **`@loop-engine/sdk/dsl` subpath no longer exists.** Any
   import from this subpath will fail at module resolution.

   *Migration:* switch to the SDK root or go direct to
   `@loop-engine/loop-definition`. Both paths are supported;
   pick based on the bundling environment:

   ```diff
   - import { parseLoopYaml } from "@loop-engine/sdk/dsl";
   + import { parseLoopYaml } from "@loop-engine/sdk";
   ```

   **Browser/edge consumers:** the SDK root transitively imports
   `node:module` (via `createRequire` in the AI-adapter loader)
   and `node:fs` (via `@loop-engine/registry-client`). If your
   bundler rejects Node built-ins, import directly from
   `@loop-engine/loop-definition` instead:

   ```diff
   - import { parseLoopYaml } from "@loop-engine/sdk/dsl";
   + import { parseLoopYaml } from "@loop-engine/loop-definition";
   ```

   This path anticipates D-18's future rename of
   `@loop-engine/loop-definition` to `@loop-engine/dsl` as a
   standalone published surface.

2. **`applyAuthoringDefaults` is no longer exported from
   `@loop-engine/sdk`.** The symbol was previously reachable only
   through the now-removed `/dsl` subpath via `export *`. It is
   an internal authoring-to-runtime boundary helper consumed by
   `@loop-engine/registry-client` (per the D-05 extension /
   PB-EX-05 Option B enforcement site) and is not on D-19's
   `1.0.0-rc.0` ship list.

   *Migration:* if your code depends on `applyAuthoringDefaults`
   (unlikely; it was never documented as public surface), import
   it from `@loop-engine/loop-definition` directly. This is
   flagged as "internal" — the symbol may be relocated,
   renamed, or removed in a future release. A `1.0.0-rc.0`
   `@loop-engine/loop-definition` export is retained to avoid
   breaking `@loop-engine/registry-client`'s cross-package
   consumption.

3. **Nine `createLoop*Event` factory functions dropped from
   `@loop-engine/sdk` public re-exports** per D-17 → A ("Internal:
   `createLoop*Event` factories"):
   - `createLoopCancelledEvent`
   - `createLoopCompletedEvent`
   - `createLoopFailedEvent`
   - `createLoopGuardFailedEvent`
   - `createLoopSignalReceivedEvent`
   - `createLoopStartedEvent`
   - `createLoopTransitionBlockedEvent`
   - `createLoopTransitionExecutedEvent`
   - `createLoopTransitionRequestedEvent`

   These were previously surfacing via the SDK's
   `export * from "@loop-engine/events"`. The explicit-named
   rewrite naturally omits them. Runtime continues to consume
   them internally via direct `@loop-engine/events` import.

   *Migration:* if your code constructs loop events directly
   (rare; consumers typically receive events via
   `InMemoryEventBus` subscriptions), either import from
   `@loop-engine/events` directly (not recommended — the package
   treats these as internal) or restructure around the event
   type schemas (`LoopStartedEventSchema`, etc.) which remain
   public.

4. **`AIActor` interface shape tightened.** The historical loose
   interface

   ```ts
   interface AIActor {
     createSubmission: (...args: unknown[]) => Promise<unknown>;
   }
   ```

   is replaced with

   ```ts
   type AIActor = ActorAdapter;
   ```

   where `ActorAdapter` is the D-13 contract at
   `@loop-engine/core`. This is a type-level tightening
   (consumers receive a more precise signature), not a runtime
   behavior change. All four provider adapters
   (`adapter-anthropic`, `adapter-openai`, `adapter-gemini`,
   `adapter-grok`) already return `ActorAdapter` post-SR-013b.

   *Migration:* code that downcasts `AIActor` to
   `{ createSubmission: (...args: unknown[]) => Promise<unknown> }`
   should remove the cast — TypeScript now infers the precise
   `createSubmission(context: LoopActorPromptContext):
   Promise<AIAgentSubmission>` signature and the
   `provider`/`model` fields automatically.

**Added to `@loop-engine/sdk` public surface per D-19:**

- `parseLoopJson(s: string): LoopDefinition`
- `serializeLoopJson(d: LoopDefinition): string`

These were in D-19's `1.0.0-rc.0` ship list but were previously
reachable only via the now-removed `/dsl` subpath. Root-barrel
access closes the pre-existing SDK-vs-D-19 mismatch.

**Class 3 gate — R-164 (root `dist/index.d.ts` surface):**

| Delta | Count | Symbols | Accountability |
|-------|-------|---------|----------------|
| Added | 2 | `parseLoopJson`, `serializeLoopJson` | D-19 ship list |
| Removed | 9 | `createLoop*Event` factories (×9) | D-17 → A / spec §4 "Internal: createLoop*Event factories" |
| Net | −7 | 158 → 151 symbols | — |

**Class 3 gate — R-186 (package-level public surface; root `/dsl`):**

| Delta | Count | Symbols | Accountability |
|-------|-------|---------|----------------|
| Added | 0 | — | — |
| Removed | 1 | `applyAuthoringDefaults` | Spec §4 entry (new; lands in bd-forge-main alongside SR-015) |
| Net | −1 | 152 → 151 symbols | — |

Combined (SR-015 end-state vs SR-014 end-state): net −8 symbols
on the SDK's package public surface, with every delta accounted
for by D-NN or spec §4.

**Procedural finding (discovered-during-SR-015, logged for
calibration).** `packages/adapter-vercel-ai/src/loop-tool-bridge.ts`
had five pre-existing `.id` accessor sites that should have
been renamed to `.loopId` / `.transitionId` when D-05 rewrote
the schemas (commit `4b8035d`). The regression was silently
masked for the duration of SR-012 through SR-014 for two
compounding reasons:

1. `tsup`'s build step emits `.js`/`.cjs` before the `dts`
   step runs, and the `dts` worker's error does not propagate
   a non-zero exit to `pnpm -r build`. The package's
   `dist/index.d.ts` was never emitted post-D-05, but the
   overall build reported success.
2. Prior SR verification steps tailed `pnpm -r typecheck` and
   `pnpm -r build` output; `tail -N` elided the
   `adapter-vercel-ai typecheck: Failed` line from view in each
   case.

Fix landed in commit `d0d2642` (five mechanical accessor
renames). Calibration update logged to bd-forge-main's
`PASS_B_EXECUTION_LOG.md` to require full-stream `rg "Failed"`
scans on workspace commands in future SR verifications.

**D-21 audit (end-of-SR-015).** Every `@loop-engine/*` package
now declares only a root export, except the sanctioned
`@loop-engine/registry-client/betterdata` entry. Audit script:

```bash
for pkg in packages/*/package.json; do
  node -e "const p=require('./$pkg'); const keys=Object.keys(p.exports||{'.':null}); if (keys.length>1 && p.name!=='@loop-engine/registry-client') process.exit(1)"
done
```

Zero violations post-R-186.

**Phase A.4 closure.** SR-015 closes Phase A.4 (barrel hygiene
+ single-root enforcement). Phase A.5 opens next with D-12
Postgres production-grade adapter (multi-day integration work;
budget orthogonal to the SR-class-1/2/3 cadence established
through Phases A.1–A.4) plus the Kafka `@experimental` companion.

**Originator.** R-164 (barrel rewrite, C-03 Class 3 gate), R-186
(D-21 single-root enforcement, hygiene), plus ride-along SDK
`AIActor` tightening (observation-tier follow-up from SR-013b),
D-19 completeness alignment (`parseLoopJson`/`serializeLoopJson`),
D-17 enforcement (`createLoop*Event` drop), and procedural-tier
D-01/D-05 cascade cleanup in `adapter-vercel-ai`.

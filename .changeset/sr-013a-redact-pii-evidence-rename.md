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
## SR-013a · MECHANICAL 8.16 · rename SDK `guardEvidence` → `redactPiiEvidence` + relocate `EvidenceRecord` to core (PB-EX-03 Option A)

**Class.** Class 1 + rename (compiler-carried) in SDK; Class 2.5-adjacent relocation in `@loop-engine/core` (new file, additive exports — no shape change to existing types).

**Scope.** Two adjacent corrections shipping as one commit per PB-EX-03 Option A resolution of the `guardEvidence` name collision and `EvidenceRecord` placement:

1. **Rename SDK's `guardEvidence` → `redactPiiEvidence`.** `packages/sdk/src/lib/guardEvidence.ts` is replaced by `packages/sdk/src/lib/redactPiiEvidence.ts` (same behavior: hardcoded PII field blocklist, prompt-injection prefix stripping, 512-char value length cap) and the SDK barrel updates accordingly. Rationale: the original name collided with `@loop-engine/core`'s generic `guardEvidence` primitive (`stripFields` + `maskPatterns` options) backing `ToolAdapter.guardEvidence`. Keeping both under the same name was incoherent — different signatures, different semantics, different packages.
2. **Relocate `EvidenceRecord` + `EvidenceValue` from `@loop-engine/sdk` to `@loop-engine/core`.** New file `packages/core/src/evidence.ts` houses both types. The SDK barrel stops exporting `EvidenceRecord` (no consumer uses the SDK import path — verified via workspace grep). The SDK's renamed `redactPiiEvidence` imports `EvidenceRecord` from `@loop-engine/core`. Rationale: both `guardEvidence` functions (the core primitive and the SDK helper) reference this type; core is the correct home for the shared contract — same closure-of-type-graph principle as PB-EX-01 / PB-EX-04's relocations of `ActorAdapter` context and actor types.

**Invariants preserved.** `ToolAdapter.guardEvidence` contract member in `@loop-engine/core` is unchanged — it continues to reference core's generic primitive with its `GuardEvidenceOptions` signature. Every existing implementer (`adapter-perplexity`'s `guardEvidence` method) continues to satisfy `ToolAdapter` without modification.

**Out of scope for this row (intentionally):**

- AI provider adapter re-homing onto `ActorAdapter` (Anthropic, OpenAI, Gemini, Grok) — lands in SR-013b per the SR-013 phased split. The PB-EX-02 Option A construction-time tuning work and the D-13 `ActorAdapter` re-homing are independent of this evidence-type housekeeping.
- `adapter-vercel-ai` — per PB-EX-07 Option A, it does not re-home onto `ActorAdapter`; it belongs to the new `IntegrationAdapter` archetype. No changes to `adapter-vercel-ai` in SR-013a.
- Consumer-package updates outside the loop-engine workspace (bd-forge-main stubs, pinned app consumers) — covered by Phase E `--13-bd-forge-main-cleanup.md`.

**Migration.**

```diff
  // SDK consumers that redact evidence before forwarding to AI adapters:
- import { guardEvidence } from "@loop-engine/sdk";
+ import { redactPiiEvidence } from "@loop-engine/sdk";

- const safe = guardEvidence({ reviewNote: "Looks good" });
+ const safe = redactPiiEvidence({ reviewNote: "Looks good" });
```

```diff
  // Consumers that typed evidence payloads via the SDK's EvidenceRecord:
- import type { EvidenceRecord } from "@loop-engine/sdk";
+ import type { EvidenceRecord } from "@loop-engine/core";
```

`@loop-engine/core`'s `guardEvidence` primitive (generic redaction with `stripFields` + `maskPatterns`) and the `ToolAdapter.guardEvidence` contract member are unchanged — no migration needed for `ToolAdapter` implementers.

**Verification.** Phase A.7 clean: workspace `pnpm -r build` green; C-10 symlink scan clean (pre + post build, zero hits); workspace `pnpm -r typecheck` green; workspace `pnpm -r test` green (all test files pass — no count change vs SR-012; the SDK's `guardEvidence` tests become `redactPiiEvidence` tests but exercise the same behavior); d.ts surface diff confirms `@loop-engine/sdk/dist/index.d.ts` exports `redactPiiEvidence` (no `guardEvidence`, no `EvidenceRecord`), and `@loop-engine/core/dist/index.d.ts` exports `guardEvidence` (the unchanged primitive), `EvidenceRecord`, and `EvidenceValue`.

**Symbol diff against 0.1.5.**

Added to `@loop-engine/core` public surface:

- `type EvidenceValue` (`= string | number | boolean | null`)
- `type EvidenceRecord` (`= Record<string, EvidenceValue>`)

Removed from `@loop-engine/sdk` public surface:

- `guardEvidence(evidence: EvidenceRecord): EvidenceRecord` — renamed; see below.
- `type EvidenceRecord` — relocated to `@loop-engine/core`.

Added to `@loop-engine/sdk` public surface:

- `redactPiiEvidence(evidence: EvidenceRecord): EvidenceRecord` — same behavior as the pre-rename `guardEvidence`; `EvidenceRecord` now sourced from `@loop-engine/core`.

Unchanged in `@loop-engine/core`:

- `guardEvidence<T extends EvidenceRecord>(evidence: T, options: GuardEvidenceOptions): EvidenceRecord` — the generic redaction primitive backing `ToolAdapter.guardEvidence`. Kept under its original name; PB-EX-03 Option A disambiguation renamed only the SDK helper.

**Originator.** PB-EX-03 (guardEvidence name collision + EvidenceRecord placement); MECHANICAL 8.16 as extended by PB-EX-03 Option A.

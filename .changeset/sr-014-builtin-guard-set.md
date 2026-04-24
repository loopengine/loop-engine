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
## SR-014 · D-15 · Built-in guard set confirmed for `1.0.0-rc.0`

**Decision confirmation.** Per D-15 → Option C ("kebab-case; union
of source + docs *only after pruning*; each shipped guard must be
generic across domains"), the `1.0.0-rc.0` built-in guard set is
confirmed as the four generic guards already registered in source:

- `confidence-threshold`
- `human-only`
- `evidence-required`
- `cooldown`

**Rule applied.** Each confirmed guard has been re-audited against
the generic-across-domains rule:

- `confidence-threshold` — parameterized on `threshold: number`,
  reads `evidence.confidence`. No coupling to any domain concept.
- `human-only` — pure `actor.type === "human"` check. No domain
  coupling.
- `evidence-required` — parameterized on `requiredFields: string[]`;
  fields are caller-specified. Guard logic is domain-agnostic
  field-presence validation.
- `cooldown` — parameterized on `cooldownMs: number`, reads
  `loopData.lastTransitionAt`. Pure time-based rate-limiting.

All four pass. No pruning required.

**Borderline candidates not shipping.** The borderline names recorded
in the resolution log (`field-value-constraint`,
`duplicate-check-passed`) and earlier candidates once considered
(`actor-has-permission`, `approval-obtained`,
`deadline-not-exceeded`) do not exist in source and are not added
for `1.0.0-rc.0`.

**No source changes.** This is a confirm-pass. `@loop-engine/guards`
source is unchanged; `packages/guards/src/registry.ts:21-26` already
registers exactly the confirmed set. No package bump is added to
this changeset for `@loop-engine/guards`; this narrative is the
release-note record of the confirmation.

**Consumer impact.** None. The observable behavior of
`defaultRegistry` and `registerBuiltIns()` has been the confirmed set
throughout Pass B; the confirmation fixes that surface as the
`1.0.0-rc.0` contract.

**Extension mechanism unchanged.** Consumers needing additional
guards register them via `GuardRegistry.register(guardId, evaluator)`.
The confirmed set is the floor, not the ceiling. Post-RC additions
of any candidate require demonstrated generic-across-domains utility
and land via minor bump under D-15's pruning rule.

**Phase A.3 closure.** SR-014 is the closing SR of Phase A.3
(decision cascade). Phase A.4 opens next (R-164 barrel rewrite,
D-21 single-root export enforcement).

**Originator.** D-15 (Option C) confirm-pass.

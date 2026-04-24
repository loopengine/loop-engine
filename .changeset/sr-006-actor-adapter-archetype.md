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
## SR-006 — `feat(core): introduce ActorAdapter archetype + relocate AIAgentSubmission + AIAgentActor to core (D-13; PB-EX-01 Option A + PB-EX-04 Option A)`

**Surface change.** `@loop-engine/core` adds the new
`ActorAdapter` interface (the AI-as-actor archetype, paired with
the existing `ToolAdapter` AI-as-capability archetype), and gains
four supporting types previously owned by `@loop-engine/actors`:
`AIAgentActor`, `AIAgentSubmission`, `LoopActorPromptContext`,
`LoopActorPromptSignal`.

**Why ActorAdapter is here.** Loop Engine has two AI integration
archetypes — the AI as decision-making actor (`ActorAdapter`) and
the AI as a callable capability/tool (`ToolAdapter`). Both
contracts live in `@loop-engine/core` so adapter packages depend
on a single foundational interface surface. See
`API_SURFACE_DECISIONS_RESOLVED.md` D-13 for the full archetype
rationale.

**Why the relocation.** Placing `ActorAdapter` in `core` requires
that `core` be closed under its own type graph: every type
`ActorAdapter` references (and every type those types reference)
must also live in `core`. The four relocated types form
`ActorAdapter`'s transitive contract surface. `core` has no
workspace dependency on `@loop-engine/actors`, so leaving any of
them in `actors` would create a `core → actors → core` type-level
cycle. Captured as the D-13 first + second extensions in
`API_SURFACE_DECISIONS_RESOLVED.md` (originating findings:
PB-EX-01 + PB-EX-04 in `PASS_B_EXCEPTIONS.md`).

**Implementer count at this release.** Zero by design.
`ActorAdapter` is a net-new contract; the five expected
implementer adapters (Anthropic, OpenAI, Gemini, Grok, Vercel-AI)
re-home onto it via Phase A.3's MECHANICAL 8.16 commit.

**Migration (consumers of the four relocated types):**

```diff
- import type { AIAgentActor, AIAgentSubmission, LoopActorPromptContext, LoopActorPromptSignal } from "@loop-engine/actors";
+ import type { AIAgentActor, AIAgentSubmission, LoopActorPromptContext, LoopActorPromptSignal } from "@loop-engine/core";
```

`@loop-engine/actors` continues to own the rest of its surface
(`HumanActor`, `AutomationActor`, `SystemActor`, the actor Zod
schemas including `AIAgentActorSchema`, `isAuthorized` /
`canActorExecuteTransition`, `buildAIActorEvidence`,
`ActorDecisionError`, `AIActorDecision`, `ActorDecisionErrorCode`).
The `Actor` union (`HumanActor | AutomationActor | AIAgentActor`)
keeps its shape — `actors` now imports `AIAgentActor` from `core`
to construct the union, so consumers see no shape change.

**Migration (implementing ActorAdapter):**

```ts
import type { ActorAdapter, LoopActorPromptContext, AIAgentSubmission } from "@loop-engine/core";

export class MyProviderActorAdapter implements ActorAdapter {
  provider = "my-provider";
  model = "model-name";
  async createSubmission(context: LoopActorPromptContext): Promise<AIAgentSubmission> {
    // ...
  }
}
```

**Out of scope for this row (intentionally):**

- AI provider adapters' re-homing onto `ActorAdapter` — landed
  in Phase A.3 (MECHANICAL 8.16 commit). At this release the
  five AI adapters still expose their bespoke per-provider types
  (`AnthropicLoopActor`, `OpenAILoopActor`, `GeminiLoopActor`,
  `GrokLoopActor`, `VercelAIActorAdapter`); the unification onto
  `ActorAdapter` follows.
- `AIAgentActorSchema` (Zod schema) stays in `@loop-engine/actors`
  — it's a value rather than a type-graph participant in the
  cycle that motivated the relocation, and consistent with the
  rest of the actor Zod schemas housed in `actors`.

**Symbol diff against 0.1.5.**

Added to `@loop-engine/core` public surface:
- `interface ActorAdapter`
- `interface AIAgentActor` (relocated from actors)
- `interface AIAgentSubmission` (relocated from actors)
- `interface LoopActorPromptContext` (relocated from actors)
- `interface LoopActorPromptSignal` (relocated from actors)

Removed from `@loop-engine/actors` public surface (consumers
update import paths per the migration block above):
- `interface AIAgentActor`
- `interface AIAgentSubmission`
- `interface LoopActorPromptContext`
- `interface LoopActorPromptSignal`

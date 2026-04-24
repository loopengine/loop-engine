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
## SR-003 · D-13 · LLMAdapter → ToolAdapter (narrow rename)

**Interface rename (no alias):**

- `@loop-engine/core` interface `LLMAdapter` → `ToolAdapter`
- source file `packages/core/src/llmAdapter.ts` →
  `packages/core/src/toolAdapter.ts` (git mv; history preserved)

**Implementer update (the lone in-tree implementer):**

- `@loop-engine/adapter-perplexity` `PerplexityAdapter` now
  declares `implements ToolAdapter`

**Out of scope for this row (intentionally):**

The four other AI provider adapters — `@loop-engine/adapter-anthropic`,
`@loop-engine/adapter-openai`, `@loop-engine/adapter-gemini`,
`@loop-engine/adapter-grok`, `@loop-engine/adapter-vercel-ai` — do
**not** implement `LLMAdapter` today; each carries a bespoke
`*ActorAdapter` shape. They re-home onto the new `ActorAdapter`
archetype (a separate, distinct interface) in Phase A.3 — not onto
`ToolAdapter`. Per D-13 the two archetypes carry different intents:
`ToolAdapter` is for grounded-tool calls (text-in / text-out + evidence);
`ActorAdapter` is for autonomous decision-making actors.

**Migration:**

```diff
- import type { LLMAdapter } from "@loop-engine/core";
+ import type { ToolAdapter } from "@loop-engine/core";

- class MyAdapter implements LLMAdapter { ... }
+ class MyAdapter implements ToolAdapter { ... }
```

The `invoke()`, `guardEvidence()`, and optional `stream()` methods
are unchanged in signature; only the interface name renames.
Consumers that only depend on `@loop-engine/adapter-perplexity`
(rather than implementing the interface themselves) need no code
changes — the package's public exports do not include
`LLMAdapter`/`ToolAdapter` directly.

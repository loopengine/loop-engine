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
## SR-005 · D-09 · `LoopEngine.listOpen` + verify cancelLoop/failLoop public surface

**Surface addition (Class 2 row, single implementer):**

- `@loop-engine/runtime` `LoopEngine.listOpen(loopId: LoopId): Promise<LoopInstance[]>`
  — net-new public method; delegates to the existing
  `LoopStore.listOpenInstances` (added in SR-002 per D-11).

**Public surface verification (no source change required):**

- `LoopEngine.cancelLoop(aggregateId, actor, reason?)` —
  pre-existing public method, confirmed not marked `private`,
  signature unchanged.
- `LoopEngine.failLoop(aggregateId, fromState, error)` —
  pre-existing public method, confirmed not marked `private`,
  signature unchanged.

**Out of scope for this row (intentionally):**

- `registerSideEffectHandler` — explicitly deferred to `1.1.0`
  per D-09; remains internal in `1.0.0-rc.0`. Docs that currently
  reference it (`runtime.mdx:43`) will be cleaned up in Branch B.1.

**Migration:**

```diff
- // Previously, listing open instances required dropping to the store directly:
- const open = await store.listOpenInstances("my.loop");
+ const open = await engine.listOpen("my.loop");
```

The store-level `listOpenInstances` method remains public on
`LoopStore` for adapter implementations and direct-store use. The
new `engine.listOpen` provides a higher-level surface for
applications that already hold a `LoopEngine` reference and don't
want to thread the store separately.

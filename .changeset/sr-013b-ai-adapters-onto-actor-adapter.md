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
## SR-013b · D-13 · AI provider adapters re-home onto `ActorAdapter` (+ PB-EX-02 Option A)

Second half of the SR-013 split. Re-homes the four AI provider
adapters — `@loop-engine/adapter-gemini`, `@loop-engine/adapter-grok`,
`@loop-engine/adapter-anthropic`, `@loop-engine/adapter-openai` — onto
the canonical `ActorAdapter` contract defined in
`@loop-engine/core/actorAdapter`. Splits into four per-adapter commits
under a shared `Surface-Reconciliation-Id: SR-013b` trailer.

PB-EX-07 Option A note: `@loop-engine/adapter-vercel-ai` is NOT
included in this re-home. It ships under the `IntegrationAdapter`
archetype and is documentation-only in SR-013b scope (the taxonomic
correction landed in the PB-EX-07 resolution-log extension).

**Per-adapter breaking changes (all four):**

- `createSubmission` input contract is now
  `(context: LoopActorPromptContext)`.
- `createSubmission` return type is now `AIAgentSubmission` (from
  `@loop-engine/core`).
- Provider adapters `implements ActorAdapter` (Gemini/Grok classes) or
  return `ActorAdapter` from their factory (Anthropic/OpenAI
  object-literal factories).
- All factory functions now have return type `ActorAdapter`.
- Signal selection happens inside the adapter: the model returns
  `signalId` in its JSON response, adapter validates against
  `context.availableSignals`, then brand-casts via the `signalId()`
  factory (D-01, SR-012).
- Actor ID generation happens inside the adapter via
  `actorId(crypto.randomUUID())` (D-01).

**Gemini + Grok — return-shape normalization (near-mechanical):**

Both adapters already took `LoopActorPromptContext` and had
construction-time tuning on `GeminiLoopActorConfig` /
`GrokLoopActorConfig` (already PB-EX-02 Option A compliant). The
re-home is return-shape normalization:

- `GeminiActorSubmission` type: removed (was
  `{ actor, decision, rawResponse }` wrapper).
- `GrokActorSubmission` type: removed (same shape as Gemini).
- `GeminiLoopActor` / `GrokLoopActor` duck-type aliases from
  `types.ts`: removed. The class name is preserved as a real class
  export from each package.
- Return shape now `{ actor, signal, evidence: { reasoning,
  confidence, dataPoints?, modelResponse } }`.

**Anthropic + OpenAI — full internal rewrite (PB-EX-02 Option A
explicitly sanctioned):**

Both adapters previously took a bespoke `createSubmission(params)`
with caller-supplied `signal`, `actorId`, `prompt`, `maxTokens`,
`temperature`, `dataPoints`, `displayName`, `metadata`. This shape is
entirely removed from the public surface:

- `CreateAnthropicSubmissionParams`: removed.
- `CreateOpenAISubmissionParams`: removed.
- `AnthropicActorAdapter` interface: removed
  (`createAnthropicActorAdapter` now returns `ActorAdapter` directly).
- `OpenAIActorAdapter` interface: removed (same).

Per-call tuning parameters (`maxTokens`, `temperature`) moved onto
construction-time options per PB-EX-02 Option A:

- `AnthropicActorAdapterOptions` gains optional `maxTokens?: number`
  and `temperature?: number`.
- `OpenAIActorAdapterOptions` gains the same.

Per-call actor-lifecycle parameters (`signal`, `actorId`, `prompt`,
`displayName`, `metadata`, `dataPoints`) are dropped from the public
contract. The model now receives a prompt constructed by the adapter
from `LoopActorPromptContext` fields (`currentState`,
`availableSignals`, `evidence`, `instruction`) and returns a
`signalId` alongside `reasoning`/`confidence`/`dataPoints`. Prompt
construction is intentionally minimal: parallels the Gemini/Grok
pattern, not a prompt-design optimization pass.

**Migration.**

_Gemini/Grok callers:_

```ts
// Before
const { actor, decision } = await adapter.createSubmission(context);
console.log(decision.signalId, decision.reasoning, decision.confidence);

// After
const { actor, signal, evidence } = await adapter.createSubmission(context);
console.log(signal, evidence.reasoning, evidence.confidence);
```

_Anthropic/OpenAI callers (the heavier migration):_

```ts
// Before
const adapter = createAnthropicActorAdapter({ apiKey, model });
const submission = await adapter.createSubmission({
  signal: "my.signal",
  actorId: "my-agent-id",
  prompt: "Recommend procurement action",
  maxTokens: 1000,
  temperature: 0.3,
});

// After
const adapter = createAnthropicActorAdapter({
  apiKey,
  model,
  maxTokens: 1000,     // moved to construction-time
  temperature: 0.3,    // moved to construction-time
});
const submission = await adapter.createSubmission({
  loopId, loopName, currentState,
  availableSignals: [{ signalId: "my.signal", name: "My Signal" }],
  instruction: "Recommend procurement action",
  evidence: { /* loop-specific context */ },
});
// The model now returns `signal` (validated against availableSignals);
// `actor.id` is generated internally as a UUID. If you need a stable
// actor identity across calls, file an issue — this is a natural
// PB-EX follow-up.
```

**Symbol diff per package.**

`@loop-engine/adapter-gemini`:

- REMOVED: `type GeminiActorSubmission`
- REMOVED: `type GeminiLoopActor` (duck-type alias; `class GeminiLoopActor` preserved)
- MODIFIED: `class GeminiLoopActor implements ActorAdapter` with
  `provider`/`model` readonly properties
- MODIFIED: `createSubmission(context: LoopActorPromptContext):
  Promise<AIAgentSubmission>`

`@loop-engine/adapter-grok`:

- REMOVED: `type GrokActorSubmission`
- REMOVED: `type GrokLoopActor` (duck-type alias; `class GrokLoopActor` preserved)
- MODIFIED: `class GrokLoopActor implements ActorAdapter`
- MODIFIED: `createSubmission(context: LoopActorPromptContext):
  Promise<AIAgentSubmission>`

`@loop-engine/adapter-anthropic`:

- REMOVED: `interface CreateAnthropicSubmissionParams`
- REMOVED: `interface AnthropicActorAdapter`
- MODIFIED: `interface AnthropicActorAdapterOptions` gains
  `maxTokens?` and `temperature?`
- MODIFIED: `createAnthropicActorAdapter(options): ActorAdapter`

`@loop-engine/adapter-openai`:

- REMOVED: `interface CreateOpenAISubmissionParams`
- REMOVED: `interface OpenAIActorAdapter`
- MODIFIED: `interface OpenAIActorAdapterOptions` gains `maxTokens?`
  and `temperature?`
- MODIFIED: `createOpenAIActorAdapter(options): ActorAdapter`

No behavioral change to `adapter-vercel-ai`, `adapter-openclaw`,
`adapter-perplexity`, or other peer adapters. `@loop-engine/sdk`'s
`createAIActor` dispatcher is unaffected because it passes only
`{ apiKey, model }` to Anthropic/OpenAI factories and
`(apiKey, { modelId, confidenceThreshold? })` to Gemini/Grok
factories — all of which remain supported signatures.

**Originator.** D-13 AI-provider-adapter contract; PB-EX-02 Option A
(input-contract conformance, construction-time tuning); PB-EX-07
Option A (three-archetype taxonomy, Vercel-AI excluded from
`ActorAdapter` re-homing).

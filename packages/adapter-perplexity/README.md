# @loop-engine/adapter-perplexity

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-perplexity.svg)](https://www.npmjs.com/package/@loop-engine/adapter-perplexity)

## Overview

`@loop-engine/adapter-perplexity` wraps the [Perplexity Sonar API](https://docs.perplexity.ai/) (OpenAI-compatible chat completions) so Loop Engine state-machine steps can perform **grounded web retrieval with citations** and **Sonar Reasoning** models for multi-step analysis. It implements `ToolAdapter` from `@loop-engine/core` and returns structured `Citation` records for audit trails.

## Installation

```bash
pnpm add @loop-engine/adapter-perplexity @loop-engine/core
# or
npm install @loop-engine/adapter-perplexity @loop-engine/core
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `PERPLEXITY_API_KEY` | Yes | API key (`pplx-...`). Never commit or log. |
| `PERPLEXITY_BASE_URL` | No | Default `https://api.perplexity.ai`. |
| `PERPLEXITY_DEFAULT_MODEL` | No | Overrides default model (e.g. `sonar-pro`). |

In code, optional `PerplexityConfig` can set `apiKey`, `baseUrl`, `defaultModel`, `defaultSearchRecency` (`month` \| `week` \| `day` \| `hour`), `timeout` (ms, default 30_000), and `retries` (default 3 for 429 / 5xx / timeout).

**Vercel / serverless:** add `PERPLEXITY_API_KEY`, and optionally `PERPLEXITY_BASE_URL` and `PERPLEXITY_DEFAULT_MODEL`, to your project environment variable audit checklist for any app that instantiates this adapter.

## Usage

### Basic Sonar search

```typescript
import { createPerplexityAdapter } from "@loop-engine/adapter-perplexity";

process.env.PERPLEXITY_API_KEY = "pplx-..."; // or pass { apiKey } in config in trusted environments only

const adapter = createPerplexityAdapter();

const result = await adapter.invoke({
  prompt: "Latest FDA guidance on cold chain for vaccines?"
});

console.log(result.text);
console.log(result.citations); // { url, title, snippet }[]
```

### Domain filter and recency

```typescript
const adapter = createPerplexityAdapter({ defaultSearchRecency: "week" });

const result = await adapter.invoke({
  prompt: "Supplier recall news",
  model: "sonar-pro",
  maxTokens: 2048,
  temperature: 0.2,
  metadata: {
    searchDomainFilter: ["fda.gov", "nih.gov"],
    searchRecencyFilter: "day",
    returnCitations: true,
    returnImages: false
  }
});
```

## Citation handling

Sonar returns `citations` and `search_results`; the adapter merges them into `result.citations`. **Do not discard them:** attach them to the Loop step `evidence` (or equivalent) for audit compliance. Before persisting or logging, call `adapter.guardEvidence(payload)` so PII-bearing URLs or text are redacted consistently with other adapters. The full provider payload is available as `result.raw` for debugging only — **never log `raw` in production**.

## Supported models

| Model | Role |
|-------|------|
| `sonar` | Grounded search |
| `sonar-pro` | Grounded search (default) |
| `sonar-reasoning` | Reasoning-oriented |
| `sonar-reasoning-pro` | Reasoning-oriented |

Perplexity renames models over time; this package pins supported IDs as the `PerplexityModel` union. If a model is sunset, upgrade this package or pass a supported `input.model`.

## Error handling

Failures surface as `PerplexityAdapterError` (`statusCode`, `retryable`). Repeated rate limits may throw `RateLimitError` (429, retryable). **400** and **401** are not retried. **429**, **500**, **503**, and **timeouts** retry with exponential backoff and jitter (up to `retries`). Integrations should map failures to the Loop step `failed` state and set `loopState.error` to the error message.

## Perplexity Computer and skills

[Perplexity Computer](https://www.perplexity.ai/computer/skills) provides hosted skills and agent-style orchestration. **This package does not call the Computer Agent API** — it is Sonar-only. Use a separate gateway integration (e.g. `gateway--perplexity-computer`) for Computer orchestration; use `@loop-engine/adapter-perplexity` when you need cited Sonar completions inside Loop Engine’s `ToolAdapter` contract.

## License

Apache-2.0. See [LICENSE](./LICENSE).

# Boundary management — `@loop-engine/adapter-perplexity`

## What this package does

- Calls Perplexity **Sonar** chat completions (`POST /chat/completions` on `https://api.perplexity.ai` by default).
- Maps Loop `AdapterInput` fields to Sonar parameters (`messages`, `model`, `search_domain_filter`, `search_recency_filter`, `return_citations`, `return_images`, etc.).
- Returns `SonarResult` with `text`, `citations`, `usage`, and `raw` API payload.
- Implements `ToolAdapter.guardEvidence` using `@loop-engine/core`’s deep `guardEvidence` helper (API key stripping and `pplx-*` masking).

## What this package does NOT do

- **Perplexity Computer Agent API** — not implemented here; use a dedicated gateway package.
- **Streaming** — `stream()` is not provided on `PerplexityAdapter` (optional on `ToolAdapter`).
- **Streaming-only image delivery** — `return_images` is passed through; this adapter does not interpret or persist image streams beyond the JSON response.
- **Perplexity Pages** or non-Sonar product surfaces.

## Dependency boundary

- **Peer:** `@loop-engine/core` only (for `ToolAdapter`, `AdapterInput`, `guardEvidence`, and related types).
- **No** `@betterdata/*` or other proprietary packages.
- Uses runtime `fetch` (Node 18+); no bundled HTTP client dependency.

## Security boundary

- API key: read from `PERPLEXITY_API_KEY` or `PerplexityConfig.apiKey`; never log either.
- Call `guardEvidence` on payloads before logging or writing audit trails; citations may contain sensitive URLs or names.
- Treat `result.raw` as sensitive provider data — omit from logs and external telemetry.

## Version compatibility

- Targets **Perplexity Sonar API v1** (OpenAI-compatible chat completions). Parameter and response shapes follow current public docs; **model names change frequently** — consume them via the exported `PerplexityModel` union and release notes when Perplexity deprecates IDs.

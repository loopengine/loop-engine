# Perplexity Sonar and Computer

Loop Engine integrates with **Perplexity Sonar** through the OSS package [`@loop-engine/adapter-perplexity`](../packages/adapter-perplexity/README.md). That adapter implements `ToolAdapter` from `@loop-engine/core`: grounded completion with **citations** for audit-friendly evidence on Loop steps.

## Sonar adapter (this repo)

- **Package:** `@loop-engine/adapter-perplexity`
- **API:** Perplexity Sonar chat completions (OpenAI-compatible), not the Computer Agent API.
- **Env vars:** `PERPLEXITY_API_KEY` (required); optional `PERPLEXITY_BASE_URL`, `PERPLEXITY_DEFAULT_MODEL`.
- **Vercel / hosted apps:** add the same variables to your environment variable audit checklist wherever the adapter is constructed.

See the package [README](../packages/adapter-perplexity/README.md) for usage, models, errors, and citation handling.

## Perplexity Computer and skills

[Perplexity Computer skills](https://www.perplexity.ai/computer/skills) describe hosted capabilities and workflows in the Perplexity client. **They are out of scope for `@loop-engine/adapter-perplexity`.** If you need Computer-side orchestration or agent APIs, plan a separate gateway integration (for example a `gateway--perplexity-computer` package) that does not conflate Sonar HTTP completions with Computer’s agent surface.

Recommended split:

| Surface | Responsibility |
|---------|----------------|
| `@loop-engine/adapter-perplexity` | Sonar `chat/completions`, citations, Loop `ToolAdapter` |
| Gateway / Computer integration | Agent API, skills, client orchestration |

This keeps OSS boundaries clear and avoids implying Computer features where only Sonar is implemented.

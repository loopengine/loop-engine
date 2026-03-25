# Provider Guardrails

## Files changed

- `packages/adapter-openai/src/index.ts`
- `packages/adapter-anthropic/src/index.ts`
- `packages/adapter-grok/src/adapter.ts`
- `packages/adapter-gemini/src/adapter.ts`
- `packages/adapter-openclaw/loop-engine-governance/example-ai-replenishment-claude.ts`
- `packages/adapter-openclaw/loop-engine-governance/example-infrastructure-change-openai.ts`
- `packages/adapter-openclaw/loop-engine-governance/example-fraud-review-grok.ts`
- `packages/adapter-openclaw/loop-engine-governance/example-expense-approval.ts`
- `packages/adapter-openclaw/loop-engine-governance/example-openclaw-integration.ts`

## Validations added

- Added early API key validation in each provider-backed adapter constructor/factory path.
- Validation fails before API calls when key is missing/empty.
- Error messages include:
  - provider identity
  - expected env var name
  - explicit statement that prompt/evidence context is sent to an external provider.

## Affected adapters

- `@loop-engine/adapter-openai`
- `@loop-engine/adapter-anthropic`
- `@loop-engine/adapter-grok`
- `@loop-engine/adapter-gemini`

## Sample error messages

- OpenAI:
  - `Missing API key... Set OPENAI_API_KEY before creating the adapter.`
- Anthropic:
  - `Missing API key... Set ANTHROPIC_API_KEY before creating the adapter.`
- xAI Grok:
  - `Missing API key... Set XAI_API_KEY before creating the adapter.`
- Gemini:
  - `Missing API key... Set GOOGLE_AI_API_KEY before creating the adapter.`

# ClawHub Registry Changes

## Files changed

- `packages/adapter-openclaw/SKILL.md`
- `packages/adapter-openclaw/loop-engine-governance/SKILL.md`

## Before / after behavior

- **Before:** metadata/disclosure details were split across two SKILL files, with conflicting maintainer and install guidance.
- **After:** both files explicitly separate local-safe mode from provider-backed mode, disclose external network/provider behavior, and use aligned provenance language.

## Exact env vars declared

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `XAI_API_KEY`
- `GOOGLE_AI_API_KEY` (documented for repo-wide Gemini adapter usage)

## Exact provider/network disclosures added

- LLM providers disclosed as optional, adapter-activated integrations:
  - OpenAI
  - Anthropic
  - xAI Grok
  - Google Gemini
- OpenClaw gateway network egress disclosed:
  - WebSocket connection via `gatewayUrl` (default `ws://127.0.0.1:18789`)
- Local-safe default clarified:
  - No external LLM calls occur unless a provider adapter is explicitly configured.

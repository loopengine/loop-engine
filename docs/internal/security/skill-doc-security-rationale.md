# Skill Doc Security Rationale

## What changed

- Reworked `packages/adapter-openclaw/loop-engine-governance/SKILL.md` to include explicit sections for:
  - `Overview`
  - `Modes of operation`
  - `Installation`
  - `Configuration`
  - `Environment variables`
  - `External network and data flow`
  - `Sensitive data guidance`
  - `Provenance`
  - `Package/source references`
  - `Security notes`
- Added explicit mode separation:
  - local governance mode
  - provider-backed mode
- Added env var matrix covering provider-backed examples and local examples.
- Added explicit data-egress statements for provider adapters and OpenClaw gateway networking.

## Why this addresses the audit

- Resolves ambiguity around whether external LLM calls happen by default.
- Makes credential requirements explicit and scoped to provider-backed mode.
- Improves trust posture by disclosing external data flow and provenance in one place.
- Aligns operational behavior with documentation claims.

## User risks now disclosed explicitly

- Evidence/prompt context may be sent to external providers when provider adapters are configured.
- Local mode does not require provider keys and does not trigger external LLM calls.
- Sensitive/regulatory data handling obligations (redaction/tokenization/review) are called out before production usage.

# Changelog

All notable changes to Loop Engine will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
Versioning: [Semantic Versioning](https://semver.org/)

## Unreleased

### Added
- `@loop-engine/adapter-perplexity` — Perplexity Sonar `ToolAdapter` with citations, retries, and `guardEvidence` integration
- `@loop-engine/core` — `ToolAdapter`, `AdapterInput` / `AdapterOutput`, and deep `guardEvidence()` for adapter audit redaction
- Docs: `docs/integrations-perplexity.md` (Sonar vs [Perplexity Computer skills](https://www.perplexity.ai/computer/skills))
- Release contract stub: `.rc/adapter-perplexity.json` (RC **DRAFT** until promoted **LOCKED**)

<!-- Note: v0.1.4 was an internal tag not published to npm. Compare link is intentionally v0.1.4...v0.1.5. -->

## [0.1.5] — 2026-03-14

### Fixed
- Replaced `workspace:*` references with explicit version pins for npm compatibility
- Fixed stale dependency pins in published tarballs
- Clean build verified — `npm install @loop-engine/sdk` works correctly

## [0.1.3] — 2026-03-14

### Added
- `repository` field added to all 23 published `@loop-engine/*` package manifests, including correct `directory` mapping for `packages/*` and `packages/adapters/*`

### Changed
- Version bumped from `0.1.2` to `0.1.3` across all `@loop-engine/*` packages

## [0.1.2] — 2026-03-13

### Added
- Keywords added to all 22 package.json files for npm discoverability
- README.md added to all packages
- LICENSE file added to all packages (Apache-2.0)

### Fixed
- Correct Apache-2.0 license field across all packages

## [0.1.1] — 2026-03-13

### Added
- LICENSE file included in published npm tarballs
- README.md included in published npm tarballs
- `@loop-engine/adapter-grok` — Grok (xAI) AI actor adapter
- `@loop-engine/adapter-gemini` — Google Gemini AI actor adapter
- `ActorDecisionError` with typed error codes (INVALID_SIGNAL, INVALID_CONFIDENCE, PARSE_FAILED, API_ERROR) in `@loop-engine/actors`

## [0.1.0] — 2026-03-12

### Added
- Initial public release of all 20 `@loop-engine/*` packages
- `@loop-engine/core` — branded ID types and Zod schemas
- `@loop-engine/dsl` — YAML loop definition parser and validator
- `@loop-engine/events` — typed event definitions and factories
- `@loop-engine/signals` — learning signal schema and extraction
- `@loop-engine/actors` — actor types and authorization logic
- `@loop-engine/guards` — guard evaluation pipeline and built-in guards
- `@loop-engine/runtime` — loop lifecycle and transition execution
- `@loop-engine/observability` — timeline reconstruction and replay
- `@loop-engine/registry-client` — loop registry client
- `@loop-engine/sdk` — main developer SDK (recommended entry point)
- `@loop-engine/ui-devtools` — React developer tools
- `@loop-engine/adapter-memory` — in-memory storage adapter
- `@loop-engine/adapter-postgres` — PostgreSQL storage adapter
- `@loop-engine/adapter-kafka` — Kafka event streaming adapter
- `@loop-engine/adapter-http` — generic HTTP storage adapter
- `@loop-engine/adapter-anthropic` — Anthropic Claude AI actor adapter
- `@loop-engine/adapter-openai` — OpenAI AI actor adapter
- `@loop-engine/adapter-openclaw` — OpenClaw integration adapter
- `@loop-engine/adapter-commerce-gateway` — Commerce Gateway adapter
- `@loop-engine/adapter-pagerduty` — PagerDuty incident adapter
- `@loop-engine/adapter-vercel-ai` — Vercel AI SDK adapter
- Apache-2.0 license
- Full test suite across all packages

[0.1.5]: https://github.com/loopengine/loop-engine/compare/v0.1.4...v0.1.5
[0.1.3]: https://github.com/loopengine/loop-engine/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/loopengine/loop-engine/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/loopengine/loop-engine/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/loopengine/loop-engine/releases/tag/v0.1.0

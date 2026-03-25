# ClawHub Audit Remediation Plan

## 1) Current files involved

- Skill docs:
  - `packages/adapter-openclaw/SKILL.md`
  - `packages/adapter-openclaw/loop-engine-governance/SKILL.md`
- OpenClaw adapter docs + metadata:
  - `packages/adapter-openclaw/README.md`
  - `packages/adapter-openclaw/package.json`
- Provider adapter docs + metadata:
  - `packages/adapter-openai/README.md`
  - `packages/adapter-openai/package.json`
  - `packages/adapter-anthropic/README.md`
  - `packages/adapter-anthropic/package.json`
  - `packages/adapter-grok/README.md`
  - `packages/adapter-grok/package.json`
  - `packages/adapter-gemini/README.md`
  - `packages/adapter-gemini/package.json`
- Provider/OpenClaw integration code:
  - `packages/adapter-openai/src/index.ts`
  - `packages/adapter-anthropic/src/index.ts`
  - `packages/adapter-grok/src/adapter.ts`
  - `packages/adapter-gemini/src/adapter.ts`
  - `packages/adapter-openclaw/src/openclaw-event-bus.ts`
- Governance examples:
  - `packages/adapter-openclaw/loop-engine-governance/example-expense-approval.ts`
  - `packages/adapter-openclaw/loop-engine-governance/example-ai-replenishment-claude.ts`
  - `packages/adapter-openclaw/loop-engine-governance/example-infrastructure-change-openai.ts`
  - `packages/adapter-openclaw/loop-engine-governance/example-fraud-review-grok.ts`
  - `packages/adapter-openclaw/loop-engine-governance/example-openclaw-integration.ts`
- Root project metadata/docs:
  - `README.md`
  - `package.json`
  - `MAINTAINERS.md`
  - `SECURITY.md`

## 2) Exact inconsistencies found

1. **Grok install instructions conflict across skill docs**
   - `packages/adapter-openclaw/SKILL.md` says:
     - `npm install @loop-engine/adapter-grok openai`
   - `packages/adapter-openclaw/loop-engine-governance/SKILL.md` says:
     - `npm install @loop-engine/adapter-grok`
     - includes "(does not require openai package)" language.
2. **Maintainer identity is inconsistent**
   - `packages/adapter-openclaw/SKILL.md`: "Maintainer: Better Data OSS Team (`oss@betterdata.co`)".
   - `packages/adapter-openclaw/loop-engine-governance/SKILL.md`: "Maintainer: Better Data, Inc. (https://betterdata.co)".
3. **Publisher/org claim conflicts with package scope**
   - `packages/adapter-openclaw/loop-engine-governance/SKILL.md` says:
     - "`@loop-engine/*` — published by the `betterdata` npm org"
     - "`@loop-engine/adapter-openclaw` — published by the `betterdata` npm org"
   - Package names in repo are scoped as `@loop-engine/*`; this statement is not aligned with package naming and may be inaccurate for external auditors.
4. **Environment variable disclosures are split and uneven**
   - One SKILL doc (`packages/adapter-openclaw/SKILL.md`) includes `GOOGLE_AI_API_KEY` as "Gemini-based examples".
   - Governance example set in `packages/adapter-openclaw/loop-engine-governance/` does not include a Gemini example.
5. **No machine-readable skill registry manifest found in repo**
   - No dedicated ClawHub skill metadata file (JSON/YAML manifest) was found; only markdown metadata sections inside SKILL docs.

## 3) Missing provenance fields

### Root `package.json`
- `repository`: **absent**
- `homepage`: **absent**
- `bugs`: **absent**
- `license`: **absent**
- `author`: **absent**

### Relevant package manifests
- `packages/adapter-openclaw/package.json`:
  - `homepage`: **absent**
  - `bugs`: **absent**
  - `author`/maintainer field: **absent**
- `packages/adapter-openai/package.json`:
  - `homepage`: **absent**
  - `bugs`: **absent**
  - `author`/maintainer field: **absent**
- `packages/adapter-anthropic/package.json`:
  - `homepage`: **absent**
  - `bugs`: **absent**
  - `author`/maintainer field: **absent**
- `packages/adapter-grok/package.json`:
  - `homepage`: **absent**
  - `bugs`: **absent**
  - `author`/maintainer field: **absent**
- `packages/adapter-gemini/package.json`:
  - `homepage`: **absent**
  - `bugs`: **absent**
  - `author`/maintainer field: **absent**

## 4) Missing disclosure fields

1. **Registry/skill metadata is markdown-only and lacks structured external-data disclosures**
   - No machine-readable field set was found for:
     - explicit provider list
     - explicit outbound network destinations
     - mode distinction ("local-only" vs "provider-backed")
2. **Provider activation behavior not consistently documented at metadata boundary**
   - Example files validate env vars, but there is no centralized metadata declaration tying:
     - provider adapter -> required key
     - provider adapter -> external data egress
3. **OpenClaw network egress not surfaced in skill metadata as a distinct integration**
   - OpenClaw adapter code uses WebSocket egress (`gatewayUrl`) in `packages/adapter-openclaw/src/openclaw-event-bus.ts`; this is not consistently surfaced as external network behavior in all skill metadata.

## 5) All env vars actually used by examples/code

Used in governance examples under `packages/adapter-openclaw/loop-engine-governance/`:
- `OPENAI_API_KEY`:
  - `example-infrastructure-change-openai.ts`
- `ANTHROPIC_API_KEY`:
  - `example-ai-replenishment-claude.ts`
- `XAI_API_KEY`:
  - `example-fraud-review-grok.ts`

Referenced by adapter docs/examples in this repo:
- `GOOGLE_AI_API_KEY`:
  - `packages/adapter-gemini/README.md`

No provider key required:
- `example-expense-approval.ts`
- `example-openclaw-integration.ts` (uses OpenClaw gateway options, not provider API keys)

## 6) All outbound network/provider integrations found

### External LLM providers
- OpenAI adapter:
  - `packages/adapter-openai/src/index.ts`
  - Uses `openai` SDK (`client.chat.completions.create`)
- Anthropic adapter:
  - `packages/adapter-anthropic/src/index.ts`
  - Uses `@anthropic-ai/sdk` (`client.messages.create`)
- xAI/Grok adapter:
  - `packages/adapter-grok/src/adapter.ts`
  - Uses `openai` SDK against `https://api.x.ai/v1`
- Gemini adapter:
  - `packages/adapter-gemini/src/adapter.ts`
  - Uses `@google/generative-ai` (`generateContent`)

### Non-LLM external egress
- OpenClaw gateway adapter:
  - `packages/adapter-openclaw/src/openclaw-event-bus.ts`
  - WebSocket connection to `gatewayUrl` (default `ws://127.0.0.1:18789`)

## 7) Recommended file-by-file edits

### Skill metadata and docs
- `packages/adapter-openclaw/SKILL.md`
  - Align maintainer, source, package-org claims with canonical repo/package metadata.
  - Add explicit "Modes of operation" (local-only vs provider-backed).
  - Add explicit provider env var table and external data-flow disclosure.
  - Fix Grok install guidance to match actual adapter packaging.
- `packages/adapter-openclaw/loop-engine-governance/SKILL.md`
  - Keep mode separation explicit.
  - Correct/verify publisher/org wording.
  - Ensure provider table matches actual examples.
  - Keep evidence egress disclosure and sensitivity guidance.

### Registry metadata (ClawHub publishing)
- Locate and update actual registry publish metadata files (if outside repo, document explicitly as external dependency).
- Add/align fields:
  - source repository URL
  - homepage/docs URL
  - maintainer identity
  - optional env vars by provider-backed mode
  - provider/network egress disclosure
  - local-safe default mode statement

### Package provenance
- `package.json` (root)
  - Add `repository`, `homepage`, `bugs`, `license` (if intended at root), and maintainership field consistent with repo convention.
- `packages/adapter-openclaw/package.json`
- `packages/adapter-openai/package.json`
- `packages/adapter-anthropic/package.json`
- `packages/adapter-grok/package.json`
- `packages/adapter-gemini/package.json`
  - Add `homepage` and `bugs`.
  - Add maintainer/author field only if this repo already uses a consistent format.

### Code-level guardrails
- `packages/adapter-openai/src/index.ts`
- `packages/adapter-anthropic/src/index.ts`
- `packages/adapter-grok/src/adapter.ts`
- `packages/adapter-gemini/src/adapter.ts`
  - Add early API key validation with provider-specific explicit error text:
    - name missing env var
    - state adapter is provider-backed and sends prompt/evidence to external provider.
  - Preserve local mode behavior (no key checks unless provider adapter used).

### Regression checks
- Add a small consistency check under `scripts/`:
  - compare env vars in SKILL docs/examples
  - assert required SKILL sections present
  - assert provenance fields present in package manifests.

## 8) Prioritized checklist

### Must fix
- [ ] Align ClawHub/skill metadata with actual env var requirements (optional-by-mode, not global).
- [ ] Add explicit external-provider/data-egress disclosure in skill metadata and docs.
- [ ] Resolve maintainer/publisher/source inconsistencies across both SKILL docs.
- [ ] Add missing provenance fields (`homepage`, `bugs`, and root provenance baseline).
- [ ] Add provider-adapter runtime key validation with explicit external-provider context.

### Should fix
- [ ] Add/confirm machine-readable registry metadata source of truth (or document where it is maintained if external to repo).
- [ ] Normalize Grok install/disclosure wording across all docs.
- [ ] Ensure OpenClaw network egress is explicitly documented as non-LLM outbound integration.
- [ ] Add CI/lint check to prevent env-var and disclosure drift.

### Nice to have
- [ ] Add a single "security disclosure matrix" doc mapping modes -> env vars -> egress.
- [ ] Add a release checklist item for ClawHub metadata/doc consistency.
- [ ] Add a test fixture to validate provider guardrail error messages remain actionable.

# Metadata Consistency Checks

## What is checked

Script: `scripts/check-security-metadata.ts`  
Run via: `pnpm check-security-metadata` (also runs during root `pnpm lint`)

Checks implemented:

1. Required SKILL sections exist in:
   - `packages/adapter-openclaw/loop-engine-governance/SKILL.md`
   - required headings:
     - `## Modes of operation`
     - `## Environment variables`
     - `## External network and data flow`
     - `## Provenance`
2. Provider env vars used in governance examples are disclosed in SKILL docs:
   - extracted from `process.env.*` usage in
     - `packages/adapter-openclaw/loop-engine-governance/*.ts`
   - each discovered env var must appear in SKILL content.
3. Provenance metadata baseline exists in key manifests:
   - `repository`
   - `homepage`
   - checked for:
     - root `package.json`
     - OpenClaw and provider adapter package manifests.

## What is intentionally not checked

- Deep semantic validation of markdown wording quality.
- Remote URL reachability checks.
- ClawHub-side schema validation (no ClawHub schema file exists in this repo).
- Full monorepo package provenance completeness outside this skill scope.

## How maintainers fix failures

1. Read the script error message to identify missing field/section.
2. Update the referenced file:
   - add missing SKILL heading or env var disclosure
   - add missing `repository` / `homepage` package metadata.
3. Re-run:
   - `pnpm check-security-metadata`
   - `pnpm lint`

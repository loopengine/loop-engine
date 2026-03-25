# Provenance Alignment

## Files changed

- `package.json`
- `README.md`
- `packages/adapter-openclaw/package.json`
- `packages/adapter-openai/package.json`
- `packages/adapter-anthropic/package.json`
- `packages/adapter-grok/package.json`
- `packages/adapter-gemini/package.json`
- `packages/adapter-openclaw/SKILL.md`
- `packages/adapter-openclaw/loop-engine-governance/SKILL.md`

## Provenance mismatches resolved

- Added root metadata fields:
  - `license`
  - `repository`
  - `homepage`
  - `bugs`
  - `author`
- Added package-level provenance fields (`homepage`, `bugs`, `author`) for adapter packages used by this skill.
- Added root README "Provenance and package trust" section with canonical repository, maintainer org, package family, and issue tracker.
- Normalized SKILL metadata language to explicitly reference canonical source and package references.

## Remaining limitations

- ClawHub-specific machine-readable registry metadata schema is not present in this repo. SKILL docs currently carry the publish-facing metadata narrative.
- Additional package manifests outside this skill scope were not modified in this pass.

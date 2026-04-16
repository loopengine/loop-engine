# Contributing to Loop Engine

## Governance

Loop Engine follows a BDFL (Benevolent Dictator for Life) model.
Better Data, Inc. controls the final roadmap and release decisions.
Community contributions are welcome and encouraged.

## How to contribute

1. Open an issue before building anything significant
2. Sign every commit with DCO: `Signed-off-by: Your Name <email>`
   (required - add `git config commit.verbose true` and use `-s` flag)
3. PRs must pass all CI checks before review
4. Breaking changes to core types require RFC (open an issue with [RFC] prefix)

## Local development setup

```bash
pnpm install
pnpm build
```

Package-scoped development:

```bash
pnpm --filter @loop-engine/runtime test
pnpm --filter @loop-engine/runtime lint
```

## Test and quality checks

Run these commands from repository root before opening a PR:

```bash
pnpm build
pnpm validate:publish   # packed @loop-engine/* tarballs must not contain workspace:* (same gate as release)
pnpm lint
pnpm test
pnpm validate-loops
pnpm check-boundary
```

## Publishing (maintainers)

1. **Local gate** — `pnpm build && pnpm validate:publish`. This is the tarball check (not `npm publish`). It fails if any packed public package still has `workspace:` in its manifest.
2. **Ship changes via PR** — packaging fixes (e.g. `package.json`, `.npmrc`, `scripts/check-no-workspace-refs.mjs`, workflow updates) go through CI like any other change.
3. **CI publish** — [.github/workflows/rc-tag-release.yml](.github/workflows/rc-tag-release.yml) publishes from GitHub Actions only. It runs on **semver tag push** (`v*.*.*`): install → build → `validate:publish` → `pnpm publish -r` with **`NODE_AUTH_TOKEN`** set from the **`NPM_TOKEN`** repository secret (the env name must be `NODE_AUTH_TOKEN` for `setup-node`’s `.npmrc`). Provenance is enabled (`id-token: write`) except in dry-run mode. To **dry-run** auth and packing without uploading, use **Actions → RC tag release → Run workflow** (default is dry-run). Unchecking dry run triggers a **ref guard**: real publish is allowed only from **`main`** or a **`refs/tags/`** ref — other branches fail fast.
4. **Post-publish** — the tag workflow runs a clean `npm install @loop-engine/sdk@<version>` smoke test. Repeat manually from a scratch directory before announcing if you want extra assurance.

Local one-off releases can still use `pnpm release` (`validate:publish` + `changeset publish`) from a trusted machine; prefer the tag workflow for production npm publishes.

## Pull request conventions

- Keep PR scope focused to one feature/fix area
- Include tests for behavior changes
- Update docs when public APIs or package contracts change
- Reference linked issue or RFC in PR description

## What belongs in this repo

✅ Domain-neutral primitives (packages/core)
✅ Loop definitions that work in any runtime (loops/)
✅ Examples showing cross-domain applicability
✅ Adapters for persistence and event buses

❌ SCM-specific business logic (belongs in domain packs)
❌ AI optimization algorithms (proprietary - not accepted)
❌ Better Data-specific tenant or billing logic (proprietary)
❌ Any import from packages outside this repository

## Versioning

All packages follow semver strictly.
Breaking changes to event schemas require 6-month deprecation notice.
Use changesets for all version bumps: `pnpm changeset`

## License

Loop Engine is licensed under the Apache License 2.0 (see `LICENSE`).
By submitting a contribution, you agree that your contribution is provided under the same license.

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
3. **Automated npm publish** — [.github/workflows/rc-tag-release.yml](.github/workflows/rc-tag-release.yml) runs on pushes to `main` whose head commit message contains `chore(release)` (the changesets “Version Packages” merge). It runs `validate:publish` again before `pnpm release` / `changeset publish`; if validation fails, nothing is published.
4. **Post-publish smoke test** — from an empty directory, install the new version, e.g. `npm install @loop-engine/sdk@<version>`, and confirm the install is clean before announcing.

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

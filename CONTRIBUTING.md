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

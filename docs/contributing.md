# Contributing (Technical Guide)

This page is a short contributor reference. For governance and policy, see root
`CONTRIBUTING.md`.

## Development setup

```bash
git clone https://github.com/loopengine/loop-engine
cd loop-engine
pnpm install
pnpm build
pnpm test
```

## Running tests for a specific package

```bash
pnpm --filter @loop-engine/core test
pnpm --filter @loop-engine/runtime test
pnpm --filter @loop-engine/guards test
pnpm --filter @loop-engine/events test
```

## Validating loop definitions

```bash
pnpm validate-loops
```

This validates `loops/**/*.yaml` through the DSL parser/schema and additional checks:

- `initialState` exists in `states`
- at least one terminal state exists
- at least one transition leads to a terminal state
- each transition references valid `from`/`to` states

## Checking package boundaries

```bash
pnpm check-boundary
```

Expected success output is 6 PASS lines:

- `PASS dependency-declarations`
- `PASS core-domain-neutrality`
- `PASS adapter-peer-deps`
- `PASS publishability`
- `PASS license`
- `PASS apache-headers`

If a check fails, fix the reported package/file before opening a PR.

## Adding a new loop definition

1. Create YAML file under `loops/{domain}/{name}.yaml`.
2. Follow `schemas/loop-definition.schema.json`.
3. Run `pnpm validate-loops` (must pass).
4. Add/adjust tests if the loop introduces new guard behavior patterns.

## Adding a new built-in guard

1. Create `packages/guards/src/built-in/{name}.ts`.
2. Export a `GuardFunction` (`packages/guards/src/types.ts`).
3. Register it in `packages/guards/src/index.ts` under `defaultRegistry`.
4. Add tests in `packages/guards/src/__tests__/`.

## Adding a new adapter

1. Create `packages/adapters/{name}/`.
2. Implement `LoopStore` (for stores) and/or `EventBus` contracts from `packages/runtime/src/interfaces.ts`.
3. Put external drivers in `peerDependencies` (not `dependencies`) when required.
4. Add the package path to `pnpm-workspace.yaml` if needed.

## Commit conventions

Use conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` build/config/tooling
- `feat!:` breaking change (requires RFC)

All commits must be signed:

```bash
git commit -s -m "feat: add ..."
```

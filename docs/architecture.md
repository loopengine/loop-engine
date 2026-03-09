# Architecture

Loop Engine is structured as composable packages:

- `@loop-engine/core`: neutral types and domain model
- `@loop-engine/dsl`: parsing, validation, and authoring
- `@loop-engine/runtime`: execution engine
- `@loop-engine/events` / `@loop-engine/signals` / `@loop-engine/actors` / `@loop-engine/guards`: runtime semantics
- `@loop-engine/sdk`: developer entry point

The core rule is portability: loop definitions are runtime-agnostic and can be
executed by any compatible Loop Engine runtime.

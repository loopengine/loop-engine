# Architecture

Loop Engine is structured as composable packages:

- `@loopengine/core`: neutral types and domain model
- `@loopengine/dsl`: parsing, validation, and authoring
- `@loopengine/runtime`: execution engine
- `@loopengine/events` / `@loopengine/signals` / `@loopengine/actors` / `@loopengine/guards`: runtime semantics
- `@loopengine/sdk`: developer entry point

The core rule is portability: loop definitions are runtime-agnostic and can be
executed by any compatible Loop Engine runtime.

# Contributing Docs

Project contribution workflow is defined in the root `CONTRIBUTING.md`.
This docs page is a stable URL entrypoint for docs-site references.

## Versioning Rules

- `patch`: bug fixes and non-breaking improvements
- `minor`: new features and new packages (backward compatible)
- `major`: breaking changes to event schema, core types, or runtime API

Breaking changes require RFC + a 6-month deprecation notice on the prior version.
Breaking changes to `@loopengine/events` require a separate RFC because schema shifts
affect downstream analytics and model-training consumers.

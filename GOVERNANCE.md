# Loop Engine Governance

## Project identity

Loop Engine is an open infrastructure project for constrained, observable,
and improvable enterprise operational loops.

It was created by the engineering team at [Better Data](https://betterdata.co),
where it powers Commerce Chain Optimization across healthcare, pharma,
retail, and manufacturing.

## Governance model

Loop Engine currently operates under a BDFL (Benevolent Dictator for Life) model.
Roadmap direction and final release decisions rest with the founding maintainer team
at Better Data.

This model is appropriate for early-stage infrastructure projects.
As the contributor base grows, governance will evolve toward a more distributed model.
That evolution will be documented here.

## What this means in practice

- External contributions are welcomed and reviewed promptly.
- Significant feature proposals require an RFC (open an issue with `[RFC]` in the title).
- Breaking changes to core types or event schemas require RFC approval plus a
  6-month deprecation notice on the prior version before removal.
- The maintainer team reserves the right to decline contributions that conflict
  with the project's design principles (see [docs/architecture.md](docs/architecture.md)).

## Maintainers

See [MAINTAINERS.md](MAINTAINERS.md) for the current maintainer list.

## Decision-making

**Routine contributions** (bug fixes, documentation, new adapters, new loop definitions):
Maintainer review and approval is sufficient. No RFC required.

**New packages or significant API changes:**
RFC required. Minimum 2-week comment period before implementation begins.

**Breaking changes to `@loop-engine/core`, `@loop-engine/events`, or `@loop-engine/dsl`:**
RFC required. 6-month deprecation window on the prior version before removal.

Rationale: event schemas are consumed by AI training pipelines downstream.
An unexpected schema change can cause silent data corruption weeks or months later.
This window gives consumers time to migrate safely.

## Commercial relationship

Better Data builds commercial products on top of Loop Engine.
Those products are maintained separately at [github.com/betterdataco](https://github.com/betterdataco).

Loop Engine's OSS roadmap is not dictated by Better Data's product roadmap.
Features required only by Better Data's proprietary platform will not be added
to this repo — they belong in `betterdataco/*`, not here.

## RFC process

1. Open a GitHub issue with `[RFC]` in the title
2. Describe: the problem, the proposed change, alternatives considered
3. Minimum 2-week comment period
4. Maintainer team votes — simple majority required
5. If approved: open a PR referencing the RFC issue
6. Link the merged PR back to the RFC issue when closing

Full RFC guidance: [docs/governance/rfc-process](https://loopengine.io/docs/governance/rfc-process)

## Contact

Governance questions: [oss@betterdata.co](mailto:oss@betterdata.co)
Code of Conduct reports: [conduct@loopengine.io](mailto:conduct@loopengine.io)

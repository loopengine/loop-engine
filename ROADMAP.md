# Roadmap

## v0.1 - Foundation (current)

- [x] Core domain model (@loopengine/core)
- [x] DSL - YAML and TypeScript builder (@loopengine/dsl)
- [x] Runtime - state machine executor (@loopengine/runtime)
- [x] Guards - deterministic policy checks (@loopengine/guards)
- [x] Actors - human, automation, AI agent model (@loopengine/actors)
- [x] Events - canonical structured event schema (@loopengine/events)
- [x] SDK - developer entry point (@loopengine/sdk)
- [x] Adapters - memory, Postgres, Kafka, HTTP
- [x] Canonical loops - SCM, CRM, finance, support

## v0.2 - Observability + Devtools

- [ ] Observability package - metrics, timeline, replay (@loopengine/observability)
- [ ] UI Devtools - React panel for loop inspection (@loopengine/ui-devtools)
- [ ] Loop Inspector app
- [ ] Signal rules - state dwell, threshold breach, guard pattern

## v0.3 - Registry

- [ ] Registry client (@loopengine/registry-client)
- [ ] Local registry support
- [ ] loop-registry repo (hosted discovery)

## v1.0 - Stable

- [ ] Stable API across all core packages
- [ ] 6-month deprecation window enforced on breaking changes
- [ ] Community governance model documented

This roadmap reflects current thinking. It will change based on contributor
input and real-world usage. Open an RFC issue to propose additions.

# Roadmap

## v0.1 - Foundation (current)

- [x] Core domain model (@loop-engine/core)
- [x] DSL - YAML and TypeScript builder (@loop-engine/loop-definition)
- [x] Runtime - state machine executor (@loop-engine/runtime)
- [x] Guards - deterministic policy checks (@loop-engine/guards)
- [x] Actors - human, automation, AI agent model (@loop-engine/actors)
- [x] Events - canonical structured event schema (@loop-engine/events)
- [x] SDK - developer entry point (@loop-engine/sdk)
- [x] Adapters - memory, Postgres, Kafka, HTTP
- [x] Canonical loops - SCM, CRM, finance, support

## v0.2 - Observability + Devtools

- [ ] Observability package - metrics, timeline, replay (@loop-engine/observability)
- [ ] UI Devtools - React panel for loop inspection (@loop-engine/ui-devtools)
- [ ] Loop Inspector app
- [ ] Signal rules - state dwell, threshold breach, guard pattern

## v0.3 - Registry

- [ ] Registry client (@loop-engine/registry-client)
- [ ] Local registry support
- [ ] loop-registry repo (hosted discovery)

## v1.0 - Stable

- [ ] Stable API across all core packages
- [ ] 6-month deprecation window enforced on breaking changes
- [ ] Community governance model documented

This roadmap reflects current thinking. It will change based on contributor
input and real-world usage. Open an RFC issue to propose additions.

# @loop-engine/adapter-kafka

[![npm](https://img.shields.io/npm/v/@loop-engine/adapter-kafka.svg)](https://www.npmjs.com/package/@loop-engine/adapter-kafka)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Loop Engine](https://img.shields.io/badge/loopengine.io-docs-blue)](https://loopengine.io/docs)

Kafka event adapter for Loop Engine - publish loop events to Kafka topics for streaming and analytics.

## Install

```bash
npm install @loop-engine/adapter-kafka kafkajs
```

## Quick Start

```ts
import { Kafka } from "kafkajs";
import { kafkaEventBus } from "@loop-engine/adapter-kafka";

const kafka = new Kafka({ clientId: "loop-engine", brokers: ["localhost:9092"] });
const eventBus = kafkaEventBus({
  kafka: { producer: () => kafka.producer(), consumer: () => kafka.consumer({ groupId: "loop-engine" }) } as never,
  topic: "loop-events"
});
```

## Surface status at `1.0.0-rc.0`

| Method | Status | Notes |
|--------|--------|-------|
| `emit(event)` | **Stable** | Serializes the event and produces it to the configured topic via the supplied `kafkajs` producer. |
| `subscribe(handler)` | **`@experimental` stub** | Present on the returned bus for `EventBus`-interface completeness; throws at call time. Do not call in production code. Return type is `never` so TypeScript flags misuse at compile time. A real subscription implementation (spawning a `kafkajs` consumer, wiring per-message handlers, returning a teardown callback) is tracked against the `1.1.0` milestone. |

Consumers that only need to publish Loop events are fully served by
this adapter at RC. Consumers that need subscription should continue
using `@loop-engine/adapter-memory`'s in-memory bus or wait for the
`subscribe` implementation.

## Documentation link

https://loopengine.io/docs/integrations/kafka

## License

Apache-2.0 © Better Data, Inc.

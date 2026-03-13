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

## Documentation link

https://loopengine.io/docs/integrations/kafka

## License

Apache-2.0 © Better Data, Inc.

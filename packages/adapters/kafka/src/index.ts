// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopEvent } from "@loop-engine/events";
import type { EventBus } from "@loop-engine/runtime";

type ProducerLike = { send(args: { topic: string; messages: { value: string }[] }): Promise<void> };
type ConsumerLike = {
  connect(): Promise<void>;
  subscribe(args: { topic: string; fromBeginning?: boolean }): Promise<void>;
  run(args: { eachMessage: (p: { message: { value: Buffer | null } }) => Promise<void> }): Promise<void>;
};
type KafkaLike = {
  producer(): ProducerLike;
  consumer(args: { groupId: string }): ConsumerLike;
};

/**
 * Kafka-backed {@link EventBus} for publishing Loop events to a Kafka topic.
 *
 * **Surface status at `1.0.0-rc.0`.** `emit` is the stable side of this
 * adapter — events are serialized and produced to the configured topic.
 * `subscribe` is present on the returned bus for `EventBus`-interface
 * completeness but is marked `@experimental` and throws at call time.
 * A real `subscribe` implementation (spawning a `kafkajs` consumer,
 * wiring per-message handlers, returning a teardown callback) lands in
 * a future release; see the method's JSDoc for the current throw
 * contract.
 *
 * Consumers that only need to publish Loop events are fully served by
 * this adapter at RC. Consumers that need subscription should continue
 * using the in-memory bus or wait for the subscribe implementation.
 */
export function kafkaEventBus(options: {
  kafka: KafkaLike;
  topic: string;
  groupId?: string;
}): EventBus {
  const producer = options.kafka.producer();
  return {
    async emit(event: LoopEvent): Promise<void> {
      await producer.send({
        topic: options.topic,
        messages: [{ value: JSON.stringify(event) }]
      });
    },
    /**
     * @experimental Stub implementation for surface completeness at
     *               `1.0.0-rc.0`. Will be implemented in a future
     *               release (tracked against the `1.1.0` milestone).
     * @throws Always throws — do not call in production code.
     *
     * The method is declared `never` in its return type so callers
     * that assume a teardown handle (`() => void`, per the `EventBus`
     * contract) surface the mistake at compile time rather than as a
     * runtime surprise.
     */
    subscribe(_handler: (event: LoopEvent) => Promise<void>): never {
      throw new Error(
        "@loop-engine/adapter-kafka: subscribe() is stubbed at 1.0.0-rc.0. " +
          "Only emit() is implemented. Track the 1.1.0 milestone for the subscribe() implementation."
      );
    }
  };
}

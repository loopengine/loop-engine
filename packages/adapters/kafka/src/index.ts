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
    }
  };
}

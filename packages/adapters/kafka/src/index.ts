// @license MIT
// SPDX-License-Identifier: MIT
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
  let active = true;
  return {
    async emit(event: LoopEvent): Promise<void> {
      await producer.send({
        topic: options.topic,
        messages: [{ value: JSON.stringify(event) }]
      });
    },
    subscribe(handler: (event: LoopEvent) => Promise<void>): () => void {
      const consumer = options.kafka.consumer({ groupId: options.groupId ?? "loopengine" });
      void consumer
        .connect()
        .then(() => consumer.subscribe({ topic: options.topic, fromBeginning: false }))
        .then(() =>
          consumer.run({
            eachMessage: async ({ message }) => {
              if (!active || !message.value) return;
              await handler(JSON.parse(message.value.toString("utf8")) as LoopEvent);
            }
          })
        )
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  };
}

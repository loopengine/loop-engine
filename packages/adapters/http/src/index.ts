// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopEvent } from "@loop-engine/events";
import type { EventBus } from "@loop-engine/runtime";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function httpEventBus(options: {
  webhookUrl: string;
  headers?: Record<string, string>;
  retries?: number;
}): EventBus {
  return {
    async emit(event: LoopEvent): Promise<void> {
      const retries = options.retries ?? 3;
      for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
          fetch(options.webhookUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(options.headers ?? {})
            },
            body: JSON.stringify(event)
          }).catch(() => {});
          return;
        } catch {
          if (attempt === retries - 1) return;
          await sleep(2 ** attempt * 100);
        }
      }
    },
    subscribe(): () => void {
      throw new Error("WebhookEventBus does not support subscribe");
    }
  };
}

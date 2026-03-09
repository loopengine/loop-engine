// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopEvent } from "./types";

type Handler = (event: LoopEvent) => Promise<void>;

export class InMemoryEventBus {
  private handlers = new Set<Handler>();

  async emit(event: LoopEvent): Promise<void> {
    for (const h of this.handlers) {
      try {
        await h(event);
      } catch {
        // Handler errors should not block emission.
      }
    }
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

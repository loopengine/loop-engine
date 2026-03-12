// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { InMemoryEventBus, type LoopEvent } from "@loop-engine/events";
import type { EventBus } from "@loop-engine/runtime";
import WebSocket from "ws";
import { formatEventMessage } from "./formatters";
import type { OpenClawAdapterOptions } from "./types";

type ResolvedOptions = Required<
  Omit<OpenClawAdapterOptions, "inner" | "accountId" | "idempotencyKey">
> & {
  inner: EventBus;
  accountId?: string;
  idempotencyKey?: (event: LoopEvent) => string;
};

export class OpenClawEventBus implements EventBus {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly options: ResolvedOptions;
  private isConnected = false;
  private handlers = new Set<(event: LoopEvent) => Promise<void>>();

  constructor(options: OpenClawAdapterOptions);
  constructor(inner: EventBus, options: Omit<OpenClawAdapterOptions, "inner">);
  constructor(
    innerOrOptions: EventBus | OpenClawAdapterOptions,
    maybeOptions?: Omit<OpenClawAdapterOptions, "inner">
  ) {
    let inputOptions: OpenClawAdapterOptions;
    if (isEventBus(innerOrOptions)) {
      if (!maybeOptions) {
        throw new Error(
          "[@loop-engine/adapter-openclaw] OpenClawEventBus(innerBus, options) requires options with channel and target."
        );
      }
      inputOptions = { ...maybeOptions, inner: innerOrOptions };
    } else {
      inputOptions = innerOrOptions;
    }
    this.options = {
      gatewayUrl: "ws://127.0.0.1:18789",
      events: ["loop.transition.executed", "loop.completed", "loop.guard.failed"],
      loopIds: [],
      approvalStates: [],
      autoReconnect: true,
      reconnectDelay: 5000,
      inner: new InMemoryEventBus(),
      ...inputOptions
    };
    this.connect();
  }

  subscribe(handler: (event: LoopEvent) => Promise<void>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async emit(event: LoopEvent): Promise<void> {
    await this.options.inner.emit(event);
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch {
        // Subscriber handler failures must not block event emission.
      }
    }
    if (this.shouldForward(event)) this.sendToGateway(event);
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  private shouldForward(event: LoopEvent): boolean {
    const { events, loopIds } = this.options;
    if (!events.includes("*") && !events.includes(event.type)) return false;
    if (loopIds.length > 0 && !loopIds.includes(String(event.loopId))) return false;
    return true;
  }

  private sendToGateway(event: LoopEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
      console.warn("[@loop-engine/adapter-openclaw] Gateway not connected, dropping:", event.type);
      return;
    }
    const message = formatEventMessage(
      event,
      this.options.channel,
      this.options.target,
      this.options.approvalStates,
      this.options.accountId,
      this.options.idempotencyKey?.(event)
    );
    this.ws.send(JSON.stringify(message));
  }

  private connect(): void {
    this.ws = new WebSocket(this.options.gatewayUrl);

    this.ws.on("open", () => {
      this.isConnected = true;
      console.log("[@loop-engine/adapter-openclaw] Connected to OpenClaw gateway");
    });

    this.ws.on("error", (error) => {
      this.isConnected = false;
      console.error("[@loop-engine/adapter-openclaw] WebSocket error:", error.message);
    });

    this.ws.on("close", () => {
      this.isConnected = false;
      if (this.options.autoReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.options.reconnectDelay);
      }
    });
  }
}

function isEventBus(value: EventBus | OpenClawAdapterOptions): value is EventBus {
  return typeof (value as EventBus).emit === "function";
}

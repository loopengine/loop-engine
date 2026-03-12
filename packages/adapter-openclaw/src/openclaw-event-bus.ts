import { InMemoryEventBus, type LoopEvent } from "@loop-engine/events";
import type { EventBus } from "@loop-engine/runtime";
import WebSocket from "ws";
import { formatEventMessage } from "./formatters";
import type { OpenClawAdapterOptions } from "./types";

type ResolvedOptions = Required<
  Omit<OpenClawAdapterOptions, "inner" | "accountId">
> & {
  inner: EventBus;
  accountId?: string;
};

export class OpenClawEventBus implements EventBus {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly options: ResolvedOptions;
  private isConnected = false;

  constructor(options: OpenClawAdapterOptions) {
    this.options = {
      gatewayUrl: "ws://127.0.0.1:18789",
      events: ["loop.transition.executed", "loop.completed", "loop.guard.failed"],
      loopIds: [],
      approvalStates: [],
      autoReconnect: true,
      reconnectDelay: 5000,
      inner: new InMemoryEventBus(),
      ...options
    };
    this.connect();
  }

  subscribe(handler: (event: LoopEvent) => Promise<void>): () => void {
    return this.options.inner.subscribe(handler);
  }

  async emit(event: LoopEvent): Promise<void> {
    await this.options.inner.emit(event);
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
      this.options.accountId
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

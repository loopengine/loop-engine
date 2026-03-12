import type { EventBus } from "@loop-engine/runtime";

export interface OpenClawAdapterOptions {
  gatewayUrl?: string;
  channel: string;
  target: string;
  accountId?: string;
  events?: string[];
  loopIds?: string[];
  approvalStates?: string[];
  inner?: EventBus;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export interface OpenClawGatewayRequest {
  type: "req";
  id: string;
  method: "send";
  params: {
    to: string;
    message: string;
    channel?: string;
    accountId?: string;
    idempotencyKey: string;
  };
}

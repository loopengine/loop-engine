// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type {
  CommerceGatewayClientOptions,
  CreatePORequest,
  DemandForecast,
  InventoryRecord,
  LoopOutcomeEvent,
  PORecord,
  PriceRecord,
  Supplier
} from "./types";

export class CommerceGatewayClient {
  constructor(private readonly options: CommerceGatewayClientOptions) {}

  async getInventory(sku: string): Promise<InventoryRecord> {
    return this.request<InventoryRecord>(`/inventory/${encodeURIComponent(sku)}`);
  }

  async getInventoryBatch(skus: string[]): Promise<InventoryRecord[]> {
    return this.request<InventoryRecord[]>("/inventory/batch", {
      method: "POST",
      body: JSON.stringify({ skus })
    });
  }

  async getDemandForecast(sku: string, horizon?: number): Promise<DemandForecast> {
    const params = new URLSearchParams();
    if (horizon !== undefined) params.set("horizon", String(horizon));
    const query = params.size > 0 ? `?${params}` : "";
    return this.request<DemandForecast>(`/demand-forecast/${encodeURIComponent(sku)}${query}`);
  }

  async getSuppliers(sku: string): Promise<Supplier[]> {
    return this.request<Supplier[]>(`/suppliers/${encodeURIComponent(sku)}`);
  }

  async getCurrentPrice(sku: string): Promise<PriceRecord> {
    return this.request<PriceRecord>(`/pricing/${encodeURIComponent(sku)}`);
  }

  async getPriceHistory(sku: string, days: number): Promise<PriceRecord[]> {
    return this.request<PriceRecord[]>(`/pricing/${encodeURIComponent(sku)}/history?days=${days}`);
  }

  async createPurchaseOrder(order: CreatePORequest): Promise<PORecord> {
    return this.request<PORecord>("/purchase-orders", {
      method: "POST",
      body: JSON.stringify(order)
    });
  }

  async recordLoopOutcome(outcome: LoopOutcomeEvent): Promise<void> {
    // Endpoint availability differs across Commerce Gateway deployments.
    // If unavailable, caller can ignore this optional integration.
    try {
      await this.request<unknown>("/loop-outcomes", {
        method: "POST",
        body: JSON.stringify(outcome)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`recordLoopOutcome is unavailable on this Commerce Gateway instance: ${message}`);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = this.options.baseUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
        ...(init.headers as Record<string, string> | undefined)
      }
    });
    if (!response.ok) {
      throw new Error(`Commerce Gateway request failed: ${response.status} ${response.statusText}`);
    }
    if (response.status === 204) return undefined as T;
    const payload = (await response.json()) as T;
    const requestId = response.headers.get("x-request-id");
    if (requestId && payload && typeof payload === "object") {
      (payload as Record<string, unknown>).requestId = requestId;
    }
    return payload;
  }
}

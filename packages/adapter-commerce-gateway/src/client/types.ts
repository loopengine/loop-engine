// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
export interface InventoryRecord {
  sku: string;
  currentStock: number;
  reorderPoint: number;
  leadTimeDays?: number;
  requestId?: string;
}

export interface DemandForecast {
  sku: string;
  forecastedDemand: number;
  confidence: number;
  horizonDays?: number;
  requestId?: string;
}

export interface Supplier {
  id: string;
  sku: string;
  unitCost: number;
  leadTimeDays: number;
  requestId?: string;
}

export interface PriceRecord {
  sku: string;
  currency: string;
  value: number;
  effectiveAt: string;
  requestId?: string;
}

export interface CreatePORequest {
  sku: string;
  qty: number;
  supplierId: string;
  expectedUnitCost?: number;
}

export interface PORecord {
  id: string;
  sku: string;
  qty: number;
  supplierId: string;
  status: string;
  createdAt?: string;
  requestId?: string;
}

export interface LoopOutcomeEvent {
  loopId: string;
  aggregateId: string;
  outcomeId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface CommerceGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
}

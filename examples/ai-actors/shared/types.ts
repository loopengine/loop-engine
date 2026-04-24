import type { AggregateId } from "@loop-engine/core";

export interface DemandSpikeSignal {
  signalId: string;
  type: "DEMAND_SPIKE";
  detectedAt: string; // ISO timestamp
  sku: string;
  skuName: string;
  location: string;
  currentStock: number;
  reorderPoint: number;
  forecastedDemand: number;
  baselineDemand: number;
  spikePercent: number; // e.g. 89 (not 0.89)
  leadTimeDays: number;
  unitCost: number;
  currency: "USD";
}

export interface ReplenishmentContext {
  signal: DemandSpikeSignal;
  loopAggregateId: AggregateId;
  buyerEmail: string;
}

export interface AIRecommendation {
  action: "trigger_replenishment" | "defer" | "escalate";
  recommendedQty: number;
  confidence: number; // 0.0–1.0
  reasoning: string; // max 200 chars
  estimatedCost: number;
  urgency: "critical" | "high" | "medium" | "low";
}

import type { DemandSpikeSignal, ReplenishmentContext } from "./types";

export const LUMEBONDE_SIGNAL: DemandSpikeSignal = {
  signalId: "sig_lmb_dc_east_20260311_001",
  type: "DEMAND_SPIKE",
  detectedAt: "2026-03-11T14:30:00.000Z",
  sku: "LMB-BRS-001",
  skuName: "Lumebonde Bond Repair Serum 50ml",
  location: "DC-East",
  currentStock: 142,
  reorderPoint: 280,
  forecastedDemand: 527,
  baselineDemand: 279,
  spikePercent: 89,
  leadTimeDays: 14,
  unitCost: 18.4,
  currency: "USD"
};

export const REPLENISHMENT_CONTEXT: ReplenishmentContext = {
  signal: LUMEBONDE_SIGNAL,
  loopAggregateId: "repl-lmb-brs-001-dc-east-20260311",
  orgId: "lumebonde",
  buyerEmail: "supply@lumebonde.com"
};

// Computed helpers — use these in prompts and assertions
export const STOCK_DEFICIT =
  LUMEBONDE_SIGNAL.forecastedDemand - LUMEBONDE_SIGNAL.currentStock; // 385 units

export const DAYS_OF_COVER = Math.floor(
  LUMEBONDE_SIGNAL.currentStock / (LUMEBONDE_SIGNAL.baselineDemand / 30)
); // ~15 days

export const RECOMMENDED_ORDER_QTY = 500; // round lot above deficit + safety stock

export const ESTIMATED_PO_VALUE =
  RECOMMENDED_ORDER_QTY * LUMEBONDE_SIGNAL.unitCost; // $9,200

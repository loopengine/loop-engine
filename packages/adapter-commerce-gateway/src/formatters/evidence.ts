// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { Evidence } from "@loop-engine/core";
import type { DemandForecast, InventoryRecord, Supplier } from "../client/types";

export interface LlmRecommendation {
  recommendedQty: number;
  supplierId: string;
  confidence: number;
  rationale: string;
  model: string;
}

export function buildProcurementEvidence(
  cgData: {
    inventory: InventoryRecord;
    forecast: DemandForecast;
    suppliers: Supplier[];
  },
  llmRecommendation: LlmRecommendation,
  requestIds: string[]
): Evidence {
  const selectedSupplier = cgData.suppliers.find((supplier) => supplier.id === llmRecommendation.supplierId) ?? cgData.suppliers[0];
  const estimatedCost = selectedSupplier
    ? llmRecommendation.recommendedQty * selectedSupplier.unitCost
    : 0;
  return {
    recommendedSku: cgData.inventory.sku,
    recommendedQty: llmRecommendation.recommendedQty,
    estimatedCost,
    supplierId: llmRecommendation.supplierId,
    confidence: llmRecommendation.confidence,
    rationale: llmRecommendation.rationale,
    gatewayRequestIds: requestIds,
    modelUsed: llmRecommendation.model,
    timestamp: new Date().toISOString(),
    _confidence: llmRecommendation.confidence
  };
}

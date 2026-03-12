export { CommerceGatewayClient } from "./client/commerce-gateway-client";
export type {
  CommerceGatewayClientOptions,
  InventoryRecord,
  DemandForecast,
  Supplier,
  PriceRecord,
  CreatePORequest,
  PORecord,
  LoopOutcomeEvent
} from "./client/types";
export { buildProcurementActor } from "./actors/ai-procurement-actor";
export { buildPricingActor } from "./actors/ai-pricing-actor";
export { buildProcurementEvidence } from "./formatters/evidence";
export { toLoopOutcomeEvent } from "./formatters/learning-signal";

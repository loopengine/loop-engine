# @loop-engine/adapter-commerce-gateway

`@loop-engine/adapter-commerce-gateway` provides a typed Commerce Gateway client and actor factories that turn live commerce data into governed Loop Engine evidence.

## Install

```bash
npm install @loop-engine/adapter-commerce-gateway
```

Install only the LLM SDK you use:

```bash
npm install @anthropic-ai/sdk
# or
npm install openai
```

## Environment

- `COMMERCE_GATEWAY_URL`
- `COMMERCE_GATEWAY_API_KEY`

## Read/write boundary

- AI actors call **read** endpoints only (`getInventory`, `getDemandForecast`, `getSuppliers`, pricing reads).
- Write operations (`createPurchaseOrder`) run in automation flows after human approval has passed loop guards.

## Quick start

```ts
import { CommerceGatewayClient, buildProcurementActor } from "@loop-engine/adapter-commerce-gateway";

const client = new CommerceGatewayClient({
  baseUrl: process.env.COMMERCE_GATEWAY_URL!,
  apiKey: process.env.COMMERCE_GATEWAY_API_KEY!
});

const actor = buildProcurementActor({
  gatewayClient: client,
  llmProvider: "claude",
  apiKey: process.env.ANTHROPIC_API_KEY!,
  confidenceThreshold: 0.8
});
```

## API surface

- `CommerceGatewayClient`
  - `getInventory(sku)`
  - `getInventoryBatch(skus)`
  - `getDemandForecast(sku, horizon?)`
  - `getSuppliers(sku)`
  - `getCurrentPrice(sku)`
  - `getPriceHistory(sku, days)`
  - `createPurchaseOrder(order)`
  - `recordLoopOutcome(outcome)` (optional endpoint support by deployment)
- `buildProcurementActor(options)`
- `buildPricingActor(options)` (throws: coming in v0.2)
- `buildProcurementEvidence(cgData, llmRecommendation, requestIds)`
- `toLoopOutcomeEvent(input)`

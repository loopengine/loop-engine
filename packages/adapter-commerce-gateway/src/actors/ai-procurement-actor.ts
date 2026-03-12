// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Evidence } from "@loop-engine/core";
import { CommerceGatewayClient } from "../client/commerce-gateway-client";
import type { DemandForecast, InventoryRecord, Supplier } from "../client/types";
import { buildProcurementEvidence, type LlmRecommendation } from "../formatters/evidence";

export interface ActorContext {
  instance: {
    data?: Record<string, unknown>;
  };
}

export interface BuildProcurementActorOptions {
  gatewayClient: CommerceGatewayClient;
  llmProvider: "claude" | "openai";
  apiKey: string;
  confidenceThreshold?: number;
}

export function buildProcurementActor(options: BuildProcurementActorOptions) {
  return async (context: ActorContext): Promise<Evidence> => {
    const sku = String(context.instance.data?.sku ?? "");
    if (!sku) throw new Error("ActorContext.instance.data.sku is required");

    // Read-only Gateway access in AI actor: inventory, forecast, suppliers.
    const [inventory, forecast, suppliers] = await Promise.all([
      options.gatewayClient.getInventory(sku),
      options.gatewayClient.getDemandForecast(sku),
      options.gatewayClient.getSuppliers(sku)
    ]);

    const recommendation = await generateRecommendation(
      options.llmProvider,
      options.apiKey,
      { inventory, forecast, suppliers },
      options.confidenceThreshold ?? 0.8
    );
    const requestIds = [inventory.requestId, forecast.requestId, ...suppliers.map((supplier) => supplier.requestId)].filter(
      (value): value is string => Boolean(value)
    );
    return buildProcurementEvidence({ inventory, forecast, suppliers }, recommendation, requestIds);
  };
}

async function generateRecommendation(
  provider: "claude" | "openai",
  apiKey: string,
  payload: {
    inventory: InventoryRecord;
    forecast: DemandForecast;
    suppliers: Supplier[];
  },
  confidenceThreshold: number
): Promise<LlmRecommendation> {
  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system:
        "You are a procurement analyst. Produce strict JSON with keys recommendedQty, supplierId, confidence, rationale.",
      messages: [{ role: "user", content: JSON.stringify(payload) }]
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Claude response missing text block");
    return parseRecommendation(textBlock.text, "claude-sonnet-4-20250514", confidenceThreshold);
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a procurement analyst. Return strict JSON with recommendedQty, supplierId, confidence, rationale."
      },
      { role: "user", content: JSON.stringify(payload) }
    ]
  });
  const text = response.choices[0]?.message.content;
  if (!text) throw new Error("OpenAI response missing content");
  return parseRecommendation(text, "gpt-4o", confidenceThreshold);
}

function parseRecommendation(text: string, model: string, confidenceThreshold: number): LlmRecommendation {
  const parsed = JSON.parse(text) as {
    recommendedQty: number;
    supplierId: string;
    confidence: number;
    rationale: string;
  };
  if (
    typeof parsed.recommendedQty !== "number" ||
    typeof parsed.supplierId !== "string" ||
    typeof parsed.confidence !== "number" ||
    typeof parsed.rationale !== "string"
  ) {
    throw new Error("Recommendation schema invalid");
  }
  return {
    recommendedQty: parsed.recommendedQty,
    supplierId: parsed.supplierId,
    // Guard handles pass/fail; actor only reports model confidence.
    confidence: Math.max(0, Math.min(parsed.confidence, 1)),
    rationale: `${parsed.rationale} (threshold: ${confidenceThreshold.toFixed(2)})`,
    model
  };
}

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import type { AIAgentSubmission } from "@loop-engine/core";

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildAIActorEvidence(params: {
  modelId: string;
  provider: string;
  reasoning: string;
  confidence: number;
  dataPoints?: Record<string, unknown>;
  rawResponse?: unknown;
  prompt?: string;
}): Promise<
  AIAgentSubmission["evidence"] & { modelId: string; provider: string; promptHash?: string }
> {
  if (params.confidence < 0 || params.confidence > 1) {
    throw new Error(`confidence must be between 0 and 1, got ${params.confidence}`);
  }

  const promptHash = params.prompt ? await sha256(params.prompt) : undefined;
  return {
    reasoning: params.reasoning,
    confidence: params.confidence,
    ...(params.dataPoints ? { dataPoints: params.dataPoints } : {}),
    ...(params.rawResponse !== undefined ? { modelResponse: params.rawResponse } : {}),
    modelId: params.modelId,
    provider: params.provider,
    ...(promptHash ? { promptHash } : {})
  };
}

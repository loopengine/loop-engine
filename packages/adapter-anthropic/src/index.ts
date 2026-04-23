// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import Anthropic from "@anthropic-ai/sdk";
import { buildAIActorEvidence } from "@loop-engine/actors";
import type { AIAgentActor, AIAgentSubmission } from "@loop-engine/core";
import type { ActorId, SignalId } from "@loop-engine/core";

interface ParsedModelOutput {
  reasoning: string;
  confidence: number;
  dataPoints?: Record<string, unknown>;
}

export interface AnthropicActorAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
  anthropicVersion?: string;
  client?: Anthropic;
}

export interface CreateAnthropicSubmissionParams {
  signal: SignalId;
  actorId: ActorId;
  prompt: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
  dataPoints?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicActorAdapter {
  provider: "anthropic";
  model: string;
  createSubmission(params: CreateAnthropicSubmissionParams): Promise<AIAgentSubmission>;
}

function requireApiKey(apiKey: string, envVar: string): void {
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error(
      `[loop-engine/adapter-anthropic] Missing API key. This is an external provider-backed adapter and sends prompt/evidence context to Anthropic. Set ${envVar} before creating the adapter.`
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parseModelOutput(rawContent: string): ParsedModelOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("[loop-engine/adapter-anthropic] Invalid JSON response from Anthropic");
  }

  const parsedRecord = asRecord(parsed);
  if (!parsedRecord) {
    throw new Error("[loop-engine/adapter-anthropic] Anthropic response must be a JSON object");
  }

  const reasoning = parsedRecord.reasoning;
  if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
    throw new Error("[loop-engine/adapter-anthropic] Missing required string field: reasoning");
  }

  const confidence = parsedRecord.confidence;
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    throw new Error("[loop-engine/adapter-anthropic] Missing required numeric field: confidence");
  }

  if (confidence < 0 || confidence > 1) {
    throw new Error("[loop-engine/adapter-anthropic] confidence must be between 0 and 1");
  }

  const dataPoints = asRecord(parsedRecord.dataPoints);

  return {
    reasoning,
    confidence,
    ...(dataPoints ? { dataPoints } : {})
  };
}

export function createAnthropicActorAdapter(
  options: AnthropicActorAdapterOptions
): AnthropicActorAdapter {
  requireApiKey(options.apiKey, "ANTHROPIC_API_KEY");
  const model = options.model ?? "claude-3-5-sonnet-latest";
  const client =
    options.client ??
    new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      defaultHeaders: options.anthropicVersion
        ? { "anthropic-version": options.anthropicVersion }
        : undefined
    });

  return {
    provider: "anthropic",
    model,
    async createSubmission(
      params: CreateAnthropicSubmissionParams
    ): Promise<AIAgentSubmission> {
      let response: Awaited<ReturnType<Anthropic["messages"]["create"]>>;
      try {
        response = await client.messages.create({
          model,
          max_tokens: params.maxTokens ?? 500,
          temperature: params.temperature ?? 0,
          system:
            "Return strict JSON with keys: reasoning (string), confidence (0..1), and optional dataPoints (object).",
          messages: [{ role: "user", content: params.prompt }]
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Anthropic error";
        throw new Error(`[loop-engine/adapter-anthropic] Anthropic API error: ${message}`);
      }

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("[loop-engine/adapter-anthropic] Anthropic returned no text block");
      }

      const parsed = parseModelOutput(textBlock.text);
      const evidenceWithModel = await buildAIActorEvidence({
        modelId: model,
        provider: "anthropic",
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        ...(parsed.dataPoints ?? params.dataPoints
          ? { dataPoints: parsed.dataPoints ?? params.dataPoints }
          : {}),
        rawResponse: response,
        prompt: params.prompt
      });

      const actor: AIAgentActor = {
        id: params.actorId,
        type: "ai-agent",
        modelId: model,
        provider: "anthropic",
        confidence: evidenceWithModel.confidence,
        ...(params.displayName ? { displayName: params.displayName } : {}),
        ...(params.metadata ? { metadata: params.metadata } : {}),
        ...(evidenceWithModel.promptHash ? { promptHash: evidenceWithModel.promptHash } : {})
      };

      const evidence: AIAgentSubmission["evidence"] = {
        reasoning: evidenceWithModel.reasoning,
        confidence: evidenceWithModel.confidence,
        ...(evidenceWithModel.dataPoints ? { dataPoints: evidenceWithModel.dataPoints } : {}),
        ...(evidenceWithModel.modelResponse !== undefined
          ? { modelResponse: evidenceWithModel.modelResponse }
          : {})
      };

      return {
        actor,
        signal: params.signal,
        evidence
      };
    }
  };
}

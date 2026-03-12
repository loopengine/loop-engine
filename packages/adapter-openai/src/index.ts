// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import OpenAI from "openai";
import { buildAIActorEvidence, type AIAgentActor, type AIAgentSubmission } from "@loop-engine/actors";
import type { ActorId, SignalId } from "@loop-engine/core";

interface ParsedModelOutput {
  reasoning: string;
  confidence: number;
  dataPoints?: Record<string, unknown>;
}

export interface OpenAIActorAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
  organization?: string;
  client?: OpenAI;
}

export interface CreateOpenAISubmissionParams {
  signal: SignalId;
  actorId: ActorId;
  prompt: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
  dataPoints?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIActorAdapter {
  provider: "openai";
  model: string;
  createSubmission(params: CreateOpenAISubmissionParams): Promise<AIAgentSubmission>;
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
    throw new Error("[loop-engine/adapter-openai] Invalid JSON response from OpenAI");
  }

  const parsedRecord = asRecord(parsed);
  if (!parsedRecord) {
    throw new Error("[loop-engine/adapter-openai] OpenAI response must be a JSON object");
  }

  const reasoning = parsedRecord.reasoning;
  if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
    throw new Error("[loop-engine/adapter-openai] Missing required string field: reasoning");
  }

  const confidence = parsedRecord.confidence;
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    throw new Error("[loop-engine/adapter-openai] Missing required numeric field: confidence");
  }

  if (confidence < 0 || confidence > 1) {
    throw new Error("[loop-engine/adapter-openai] confidence must be between 0 and 1");
  }

  const dataPoints = asRecord(parsedRecord.dataPoints);

  return {
    reasoning,
    confidence,
    ...(dataPoints ? { dataPoints } : {})
  };
}

export function createOpenAIActorAdapter(options: OpenAIActorAdapterOptions): OpenAIActorAdapter {
  const model = options.model ?? "gpt-4o";
  const client =
    options.client ??
    new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      organization: options.organization
    });

  return {
    provider: "openai",
    model,
    async createSubmission(params: CreateOpenAISubmissionParams): Promise<AIAgentSubmission> {
      let response: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
      try {
        response = await client.chat.completions.create({
          model,
          temperature: params.temperature ?? 0,
          max_tokens: params.maxTokens ?? 500,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Return strict JSON with keys: reasoning (string), confidence (0..1), and optional dataPoints (object)."
            },
            { role: "user", content: params.prompt }
          ]
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown OpenAI error";
        throw new Error(`[loop-engine/adapter-openai] OpenAI API error: ${message}`);
      }

      const message = response.choices[0]?.message?.content;
      if (!message || typeof message !== "string") {
        throw new Error("[loop-engine/adapter-openai] OpenAI returned no assistant message content");
      }

      const parsed = parseModelOutput(message);
      const evidenceWithModel = await buildAIActorEvidence({
        modelId: model,
        provider: "openai",
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
        provider: "openai",
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

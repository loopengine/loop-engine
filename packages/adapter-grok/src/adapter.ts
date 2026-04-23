// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import { ActorDecisionError, type AIActorDecision } from "@loop-engine/actors";
import type { AIAgentActor, LoopActorPromptContext } from "@loop-engine/core";
import OpenAI from "openai";
import type { GrokActorSubmission, GrokLoopActorConfig } from "./types";

const DEFAULT_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_MODEL_ID = "grok-3";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

function requireApiKey(apiKey: string, envVar: string): void {
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new ActorDecisionError({
      code: "API_ERROR",
      raw: apiKey,
      message:
        `[loop-engine/adapter-grok] Missing API key. This is an external provider-backed adapter and sends prompt/evidence context to xAI Grok. Set ${envVar} before creating the adapter.`
    });
  }
}

function buildSystemPrompt(systemPrompt?: string): string {
  const required = [
    "You are an AI actor operating within a governed workflow loop.",
    "You must respond with a valid JSON object only. No markdown, no preamble.",
    'Your response must be: { "signalId": string, "reasoning": string, "confidence": number, "dataPoints"?: object }'
  ].join("\n");
  return systemPrompt ? `${systemPrompt}\n${required}` : required;
}

function buildUserPrompt(context: LoopActorPromptContext): string {
  return [
    `Current state: ${context.currentState}`,
    `Available signals: ${JSON.stringify(context.availableSignals, null, 2)}`,
    `Evidence: ${JSON.stringify(context.evidence ?? {}, null, 2)}`,
    `Instruction: ${context.instruction}`
  ].join("\n");
}

function isSignalAllowed(signalId: string, context: LoopActorPromptContext): boolean {
  return context.availableSignals.some((entry) => entry.signalId === signalId);
}

function parseDecision(raw: string, context: LoopActorPromptContext): AIActorDecision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ActorDecisionError({
      code: "PARSE_FAILED",
      raw,
      message: "[loop-engine/adapter-grok] Could not parse Grok response as JSON"
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ActorDecisionError({
      code: "PARSE_FAILED",
      raw: parsed,
      message: "[loop-engine/adapter-grok] Parsed response must be a JSON object"
    });
  }

  const record = parsed as Record<string, unknown>;
  const signalId = record.signalId;
  const reasoning = record.reasoning;
  const confidence = record.confidence;
  const dataPoints = record.dataPoints;

  if (typeof signalId !== "string" || !isSignalAllowed(signalId, context)) {
    throw new ActorDecisionError({
      code: "INVALID_SIGNAL",
      raw: record,
      message: "[loop-engine/adapter-grok] Model returned a signalId outside availableSignals"
    });
  }

  if (typeof confidence !== "number" || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new ActorDecisionError({
      code: "INVALID_CONFIDENCE",
      raw: record,
      message: "[loop-engine/adapter-grok] Confidence must be between 0 and 1"
    });
  }

  if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
    throw new ActorDecisionError({
      code: "PARSE_FAILED",
      raw: record,
      message: "[loop-engine/adapter-grok] Reasoning must be a non-empty string"
    });
  }

  return {
    signalId,
    reasoning,
    confidence,
    ...(dataPoints && typeof dataPoints === "object" && !Array.isArray(dataPoints)
      ? { dataPoints: dataPoints as Record<string, unknown> }
      : {})
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class GrokLoopActor {
  private readonly client: OpenAI;
  private readonly config: Required<Omit<GrokLoopActorConfig, "systemPrompt">> & Pick<GrokLoopActorConfig, "systemPrompt">;

  constructor(apiKey: string, config: GrokLoopActorConfig = {}) {
    requireApiKey(apiKey, "XAI_API_KEY");
    this.config = {
      modelId: config.modelId ?? DEFAULT_MODEL_ID,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      confidenceThreshold: config.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      ...(config.systemPrompt ? { systemPrompt: config.systemPrompt } : {})
    };
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.baseURL
    });
  }

  async createSubmission(context: LoopActorPromptContext): Promise<GrokActorSubmission> {
    const systemPrompt = buildSystemPrompt(this.config.systemPrompt);
    const userPrompt = buildUserPrompt(context);
    const fullPrompt = `${systemPrompt}\n${userPrompt}`;

    let response: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
    try {
      response = await this.client.chat.completions.create({
        model: this.config.modelId,
        response_format: { type: "json_object" },
        max_tokens: this.config.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown xAI error";
      throw new ActorDecisionError({
        code: "API_ERROR",
        raw: message,
        message: `[loop-engine/adapter-grok] xAI API error: ${message}`
      });
    }

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new ActorDecisionError({
        code: "PARSE_FAILED",
        raw: response,
        message: "[loop-engine/adapter-grok] Missing message content in response"
      });
    }

    const decision = parseDecision(content, context);
    const promptHash = await sha256(fullPrompt);

    const actor: AIAgentActor = {
      id: crypto.randomUUID() as never,
      type: "ai-agent",
      modelId: this.config.modelId,
      provider: "grok",
      confidence: decision.confidence,
      promptHash,
      toolsUsed: []
    };

    return {
      actor,
      decision,
      rawResponse: response
    };
  }
}

export function createGrokActorAdapter(apiKey: string, config: GrokLoopActorConfig = {}): GrokLoopActor {
  return new GrokLoopActor(apiKey, config);
}

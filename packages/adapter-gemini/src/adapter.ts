// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import {
  ActorDecisionError,
  type AIAgentActor,
  type AIActorDecision,
  type LoopActorPromptContext
} from "@loop-engine/actors";
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import type { GeminiActorSubmission, GeminiLoopActorConfig } from "./types";

const DEFAULT_MODEL_ID = "gemini-1.5-pro";
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

function requireApiKey(apiKey: string, envVar: string): void {
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new ActorDecisionError({
      code: "API_ERROR",
      raw: apiKey,
      message:
        `[loop-engine/adapter-gemini] Missing API key. This is an external provider-backed adapter and sends prompt/evidence context to Google Gemini. Set ${envVar} before creating the adapter.`
    });
  }
}

function buildSystemInstruction(systemPrompt?: string): string {
  const required = [
    "You are an AI actor operating within a governed workflow loop.",
    "You must respond with valid JSON only. No markdown formatting, no code blocks, no preamble.",
    "No text before or after the JSON.",
    'Your response must be exactly: { "signalId": string, "reasoning": string, "confidence": number, "dataPoints"?: object }'
  ].join("\n");
  return systemPrompt ? `${systemPrompt}\n${required}` : required;
}

function buildUserPrompt(context: LoopActorPromptContext): string {
  return [
    `Current loop state: ${context.currentState}`,
    `Available signals: ${JSON.stringify(context.availableSignals, null, 2)}`,
    `Evidence: ${JSON.stringify(context.evidence ?? {}, null, 2)}`,
    `Instruction: ${context.instruction}`,
    "",
    "Respond with JSON only. Choose the most appropriate signalId from",
    "the available signals list."
  ].join("\n");
}

function cleanGeminiJsonResponse(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseDecision(raw: string, context: LoopActorPromptContext): AIActorDecision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanGeminiJsonResponse(raw));
  } catch {
    throw new ActorDecisionError({
      code: "PARSE_FAILED",
      raw,
      message: "[loop-engine/adapter-gemini] Could not parse Gemini response as JSON"
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ActorDecisionError({
      code: "PARSE_FAILED",
      raw: parsed,
      message: "[loop-engine/adapter-gemini] Parsed response must be a JSON object"
    });
  }

  const record = parsed as Record<string, unknown>;
  const signalId = record.signalId;
  const reasoning = record.reasoning;
  const confidence = record.confidence;
  const dataPoints = record.dataPoints;

  const validSignals = context.availableSignals.map((signal) => signal.signalId);
  if (typeof signalId !== "string" || !validSignals.includes(signalId)) {
    throw new ActorDecisionError({
      code: "INVALID_SIGNAL",
      raw: record,
      message: "[loop-engine/adapter-gemini] Model returned a signalId outside availableSignals"
    });
  }

  if (typeof confidence !== "number" || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new ActorDecisionError({
      code: "INVALID_CONFIDENCE",
      raw: record,
      message: "[loop-engine/adapter-gemini] Confidence must be between 0 and 1"
    });
  }

  if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
    throw new ActorDecisionError({
      code: "PARSE_FAILED",
      raw: record,
      message: "[loop-engine/adapter-gemini] Reasoning must be a non-empty string"
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

export class GeminiLoopActor {
  private readonly genAI: GoogleGenerativeAI;
  private readonly config: Required<Omit<GeminiLoopActorConfig, "systemPrompt">> &
    Pick<GeminiLoopActorConfig, "systemPrompt">;

  constructor(apiKey: string, config: GeminiLoopActorConfig = {}) {
    requireApiKey(apiKey, "GOOGLE_AI_API_KEY");
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.config = {
      modelId: config.modelId ?? DEFAULT_MODEL_ID,
      maxOutputTokens: config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      confidenceThreshold: config.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
      ...(config.systemPrompt ? { systemPrompt: config.systemPrompt } : {})
    };
  }

  private getModel(systemInstruction: string): GenerativeModel {
    return this.genAI.getGenerativeModel({
      model: this.config.modelId,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: this.config.maxOutputTokens
        // TODO v0.2.0: responseMimeType: "application/json"
      }
    });
  }

  async createSubmission(context: LoopActorPromptContext): Promise<GeminiActorSubmission> {
    const systemInstruction = buildSystemInstruction(this.config.systemPrompt);
    const userPrompt = buildUserPrompt(context);
    const fullPrompt = `${systemInstruction}\n${userPrompt}`;
    const model = this.getModel(systemInstruction);

    let result: Awaited<ReturnType<GenerativeModel["generateContent"]>>;
    try {
      result = await model.generateContent(userPrompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Gemini API error";
      throw new ActorDecisionError({
        code: "API_ERROR",
        raw: message,
        message: `[loop-engine/adapter-gemini] Gemini API error: ${message}`
      });
    }

    const text = result.response.text();
    const decision = parseDecision(text, context);
    const promptHash = await sha256(fullPrompt);

    const actor: AIAgentActor = {
      id: crypto.randomUUID() as never,
      type: "ai-agent",
      modelId: this.config.modelId,
      provider: "gemini",
      confidence: decision.confidence,
      promptHash,
      toolsUsed: []
    };

    return {
      actor,
      decision,
      rawResponse: result.response
    };
  }
}

export function createGeminiActorAdapter(
  apiKey: string,
  config: GeminiLoopActorConfig = {}
): GeminiLoopActor {
  return new GeminiLoopActor(apiKey, config);
}

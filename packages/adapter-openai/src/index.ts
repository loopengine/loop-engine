// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import OpenAI from "openai";
import { buildAIActorEvidence } from "@loop-engine/actors";
import {
  actorId,
  signalId,
  type ActorAdapter,
  type AIAgentActor,
  type AIAgentSubmission,
  type LoopActorPromptContext
} from "@loop-engine/core";

interface ParsedModelOutput {
  signalId: string;
  reasoning: string;
  confidence: number;
  dataPoints?: Record<string, unknown>;
}

/**
 * Construction-time options for `createOpenAIActorAdapter` per PB-EX-02
 * Option A: provider-specific tuning (`maxTokens`, `temperature`) lives
 * here — not on per-call submission params — so that
 * `ActorAdapter.createSubmission(context: LoopActorPromptContext)` stays
 * narrow and contract-shaped.
 */
export interface OpenAIActorAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
  organization?: string;
  maxTokens?: number;
  temperature?: number;
  client?: OpenAI;
}

function requireApiKey(apiKey: string, envVar: string): void {
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error(
      `[loop-engine/adapter-openai] Missing API key. This is an external provider-backed adapter and sends prompt/evidence context to OpenAI. Set ${envVar} before creating the adapter.`
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function buildSystemPrompt(): string {
  return [
    "You are an AI actor operating within a governed workflow loop.",
    "Respond with a valid JSON object only. No markdown, no preamble, no text outside the JSON.",
    'Your response must be: { "signalId": string, "reasoning": string, "confidence": number, "dataPoints"?: object }',
    "`signalId` must be one of the signals listed in the user message's availableSignals array."
  ].join("\n");
}

function buildUserPrompt(context: LoopActorPromptContext): string {
  return [
    `Current state: ${context.currentState}`,
    `Available signals: ${JSON.stringify(context.availableSignals, null, 2)}`,
    `Evidence: ${JSON.stringify(context.evidence ?? {}, null, 2)}`,
    `Instruction: ${context.instruction}`
  ].join("\n");
}

function parseModelOutput(rawContent: string, context: LoopActorPromptContext): ParsedModelOutput {
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

  const parsedSignalId = parsedRecord.signalId;
  const validSignals = context.availableSignals.map((entry) => entry.signalId);
  if (typeof parsedSignalId !== "string" || !validSignals.includes(parsedSignalId)) {
    throw new Error(
      "[loop-engine/adapter-openai] Model returned a signalId outside availableSignals"
    );
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
    signalId: parsedSignalId,
    reasoning,
    confidence,
    ...(dataPoints ? { dataPoints } : {})
  };
}

export function createOpenAIActorAdapter(options: OpenAIActorAdapterOptions): ActorAdapter {
  requireApiKey(options.apiKey, "OPENAI_API_KEY");
  const model = options.model ?? "gpt-4o";
  const maxTokens = options.maxTokens ?? 500;
  const temperature = options.temperature ?? 0;
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
    async createSubmission(context: LoopActorPromptContext): Promise<AIAgentSubmission> {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(context);
      const fullPrompt = `${systemPrompt}\n${userPrompt}`;

      let response: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
      try {
        response = await client.chat.completions.create({
          model,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
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

      const parsed = parseModelOutput(message, context);
      const evidenceWithModel = await buildAIActorEvidence({
        modelId: model,
        provider: "openai",
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        ...(parsed.dataPoints ? { dataPoints: parsed.dataPoints } : {}),
        rawResponse: response,
        prompt: fullPrompt
      });

      const actor: AIAgentActor = {
        id: actorId(crypto.randomUUID()),
        type: "ai-agent",
        modelId: model,
        provider: "openai",
        confidence: evidenceWithModel.confidence,
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
        signal: signalId(parsed.signalId),
        evidence
      };
    }
  };
}

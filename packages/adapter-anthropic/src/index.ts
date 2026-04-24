// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import Anthropic from "@anthropic-ai/sdk";
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
 * Construction-time options for `createAnthropicActorAdapter` per PB-EX-02
 * Option A: provider-specific tuning (`maxTokens`, `temperature`) lives
 * here — not on per-call submission params — so that
 * `ActorAdapter.createSubmission(context: LoopActorPromptContext)` stays
 * narrow and contract-shaped.
 */
export interface AnthropicActorAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
  anthropicVersion?: string;
  maxTokens?: number;
  temperature?: number;
  client?: Anthropic;
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
    throw new Error("[loop-engine/adapter-anthropic] Invalid JSON response from Anthropic");
  }

  const parsedRecord = asRecord(parsed);
  if (!parsedRecord) {
    throw new Error("[loop-engine/adapter-anthropic] Anthropic response must be a JSON object");
  }

  const parsedSignalId = parsedRecord.signalId;
  const validSignals = context.availableSignals.map((entry) => entry.signalId);
  if (typeof parsedSignalId !== "string" || !validSignals.includes(parsedSignalId)) {
    throw new Error(
      "[loop-engine/adapter-anthropic] Model returned a signalId outside availableSignals"
    );
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
    signalId: parsedSignalId,
    reasoning,
    confidence,
    ...(dataPoints ? { dataPoints } : {})
  };
}

export function createAnthropicActorAdapter(
  options: AnthropicActorAdapterOptions
): ActorAdapter {
  requireApiKey(options.apiKey, "ANTHROPIC_API_KEY");
  const model = options.model ?? "claude-3-5-sonnet-latest";
  const maxTokens = options.maxTokens ?? 500;
  const temperature = options.temperature ?? 0;
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
    async createSubmission(context: LoopActorPromptContext): Promise<AIAgentSubmission> {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(context);
      const fullPrompt = `${systemPrompt}\n${userPrompt}`;

      let response: Awaited<ReturnType<Anthropic["messages"]["create"]>>;
      try {
        response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Anthropic error";
        throw new Error(`[loop-engine/adapter-anthropic] Anthropic API error: ${message}`);
      }

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("[loop-engine/adapter-anthropic] Anthropic returned no text block");
      }

      const parsed = parseModelOutput(textBlock.text, context);
      const evidenceWithModel = await buildAIActorEvidence({
        modelId: model,
        provider: "anthropic",
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
        provider: "anthropic",
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

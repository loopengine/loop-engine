// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import type {
  AIAgentActor,
  AIActorDecision,
  ActorDecisionError,
  LoopActorPromptContext
} from "@loop-engine/actors";

export interface GeminiLoopActorConfig {
  modelId?: string;
  maxOutputTokens?: number;
  systemPrompt?: string;
  confidenceThreshold?: number;
}

export type GeminiActorSubmission = {
  actor: AIAgentActor;
  decision: AIActorDecision;
  rawResponse: unknown;
};

export type GeminiLoopActor = {
  createSubmission(context: LoopActorPromptContext): Promise<GeminiActorSubmission>;
};

export type {
  AIAgentActor,
  AIActorDecision,
  ActorDecisionError,
  LoopActorPromptContext
};

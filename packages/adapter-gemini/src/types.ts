// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import type { AIActorDecision, ActorDecisionError } from "@loop-engine/actors";
import type { AIAgentActor, LoopActorPromptContext } from "@loop-engine/core";

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

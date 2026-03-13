// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

import type {
  AIAgentActor,
  AIActorDecision,
  ActorDecisionError,
  LoopActorPromptContext
} from "@loop-engine/actors";

export interface GrokLoopActorConfig {
  modelId?: string;
  maxTokens?: number;
  systemPrompt?: string;
  confidenceThreshold?: number;
  baseURL?: string;
}

export type GrokActorSubmission = {
  actor: AIAgentActor;
  decision: AIActorDecision;
  rawResponse: unknown;
};

export type GrokLoopActor = {
  createSubmission(context: LoopActorPromptContext): Promise<GrokActorSubmission>;
};

export type {
  AIAgentActor,
  AIActorDecision,
  ActorDecisionError,
  LoopActorPromptContext
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

/**
 * Construction-time options for `createGeminiActorAdapter` per PB-EX-02
 * Option A: provider-specific tuning lives in factory options so that
 * `ActorAdapter.createSubmission(context: LoopActorPromptContext)` stays
 * narrow and contract-shaped. `LoopActorPromptContext` carries only
 * runtime/contextual inputs; any per-adapter knob (`modelId`,
 * `maxOutputTokens`, `systemPrompt`, `confidenceThreshold`) belongs here.
 */
export interface GeminiLoopActorConfig {
  modelId?: string;
  maxOutputTokens?: number;
  systemPrompt?: string;
  confidenceThreshold?: number;
}

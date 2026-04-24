// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.

/**
 * Construction-time options for `createGrokActorAdapter` per PB-EX-02
 * Option A: provider-specific tuning lives in factory options so that
 * `ActorAdapter.createSubmission(context: LoopActorPromptContext)` stays
 * narrow and contract-shaped. `LoopActorPromptContext` carries only
 * runtime/contextual inputs; any per-adapter knob (`modelId`,
 * `maxTokens`, `systemPrompt`, `confidenceThreshold`, `baseURL`) belongs
 * here.
 */
export interface GrokLoopActorConfig {
  modelId?: string;
  maxTokens?: number;
  systemPrompt?: string;
  confidenceThreshold?: number;
  baseURL?: string;
}

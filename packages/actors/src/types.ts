// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
//
// AI archetype types — `AIAgentActor`, `AIAgentSubmission`,
// `LoopActorPromptContext`, `LoopActorPromptSignal` — relocated to
// `@loop-engine/core` per D-13 first + second extensions
// (PB-EX-01 + PB-EX-04). Consumers import them from
// `@loop-engine/core`. The `Actor` union below references
// `AIAgentActor` from core directly so the union shape is unchanged
// for downstream consumers.
import type { ActorRef, AIAgentActor } from "@loop-engine/core";
import { z } from "zod";

export interface HumanActor extends ActorRef {
  type: "human";
  userId: string;
  displayName: string;
  roles?: string[];
}

export interface AutomationActor extends ActorRef {
  type: "automation";
  serviceId: string;
  version?: string;
}

export interface SystemActor extends ActorRef {
  type: "system";
  componentId: string;
  version?: string;
}

export type Actor = HumanActor | AutomationActor | AIAgentActor | SystemActor;

export interface AIActorDecision {
  signalId: string;
  reasoning: string;
  confidence: number;
  dataPoints?: Record<string, unknown>;
}

export type ActorDecisionErrorCode =
  | "INVALID_SIGNAL"
  | "INVALID_CONFIDENCE"
  | "PARSE_FAILED"
  | "API_ERROR";

export const HumanActorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("human"),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  roles: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const AutomationActorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("automation"),
  serviceId: z.string().min(1),
  version: z.string().optional(),
  displayName: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const SystemActorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("system"),
  componentId: z.string().min(1),
  version: z.string().optional(),
  displayName: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const AIAgentActorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("ai-agent"),
  modelId: z.string().min(1),
  provider: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  promptHash: z.string().optional(),
  toolsUsed: z.array(z.string()).optional(),
  displayName: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

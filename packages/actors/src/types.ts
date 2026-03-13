// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { ActorRef, SignalId } from "@loop-engine/core";
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

export interface AIAgentActor extends ActorRef {
  type: "ai-agent";
  modelId: string;
  provider: string;
  confidence?: number;
  promptHash?: string;
  toolsUsed?: string[];
}

export type Actor = HumanActor | AutomationActor | AIAgentActor;

export interface AIAgentSubmission {
  actor: AIAgentActor;
  signal: SignalId;
  evidence: {
    reasoning: string;
    confidence: number;
    dataPoints?: Record<string, unknown>;
    modelResponse?: unknown;
  };
}

export interface LoopActorPromptSignal {
  signalId: string;
  name: string;
  description?: string;
  allowedActors?: string[];
}

export interface LoopActorPromptContext {
  loopId: string;
  loopName: string;
  currentState: string;
  availableSignals: LoopActorPromptSignal[];
  instruction: string;
  evidence?: Record<string, unknown>;
}

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

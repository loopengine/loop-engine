// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { ActorRef, ActorType, AggregateId, Evidence, LoopId, TransitionId } from "@loop-engine/core";

export interface HumanActor extends ActorRef {
  type: "human";
  sessionId: string;
}

export interface AutomationActor extends ActorRef {
  type: "automation";
  serviceId: string;
}

export interface AIAgentActor extends ActorRef {
  type: "ai-agent";
  agentId: string;
  gatewaySessionId: string;
  recommendedBy?: string;
}

export interface WebhookActor extends ActorRef {
  type: "webhook";
  source: string;
}

export interface SystemActor extends ActorRef {
  type: "system";
}

export type Actor = HumanActor | AutomationActor | AIAgentActor | WebhookActor | SystemActor;

export interface AIActorSubmission {
  actor: AIAgentActor;
  loopId: LoopId;
  aggregateId: AggregateId;
  recommendedTransition: TransitionId;
  confidence: number;
  reasoning: string;
  evidence: Evidence;
}

export type { ActorType };

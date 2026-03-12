// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.
import type { ActorRef, AggregateId, LoopDefinition, TransitionId } from "@loop-engine/core";
import type { LoopSystem, TransitionParams, TransitionResult } from "@loop-engine/runtime";

export interface CoreTool<TInput, TOutput> {
  execute: (input: TInput) => Promise<TOutput> | TOutput;
  [key: string]: unknown;
}

export interface GovernedToolConfig<TInput = unknown> {
  loopDefinition: LoopDefinition;
  engine: LoopSystem;
  requiresApproval?: (input: TInput) => boolean;
  onApprovalRequired?: (loopId: string, input: TInput) => Promise<void>;
  actor: ActorRef;
}

export interface LoopToolConfig<TInput = unknown> {
  definition: LoopDefinition;
  engine: LoopSystem;
  actor: ActorRef;
  input: TInput;
}

export interface PendingApprovalResult {
  status: "pending_approval";
  loopId: string;
  message: "Awaiting human approval";
}

export interface GovernedExecutionContext {
  aggregateId: AggregateId;
  transitionedToAnalysis: boolean;
}

export interface TransitionRequest {
  aggregateId: AggregateId;
  transitionId: TransitionId;
  actor: TransitionParams["actor"];
  evidence?: Record<string, unknown>;
}

export type GovernedTransitionResult = TransitionResult;

import type { ActorRef, AggregateId, Evidence, LoopDefinition, TransitionId } from "@loop-engine/core";
import type { LoopEngine, StartOptions, TransitionResult } from "@loop-engine/runtime";

export interface CoreTool<TInput, TOutput> {
  execute: (input: TInput) => Promise<TOutput> | TOutput;
  [key: string]: unknown;
}

export interface GovernedToolConfig<TInput = unknown> {
  loopDefinition: LoopDefinition;
  engine: LoopEngine;
  requiresApproval?: (input: TInput) => boolean;
  onApprovalRequired?: (loopId: string, input: TInput) => Promise<void>;
  actor: ActorRef;
}

export interface LoopToolConfig<TInput = unknown> {
  definition: LoopDefinition;
  engine: LoopEngine;
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
  actor: StartOptions["actor"];
  evidence?: Evidence;
}

export type GovernedTransitionResult = TransitionResult;

// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * Actor adapter contract for Loop Engine state-machine steps where an
 * external AI provider acts as the autonomous decision-making actor —
 * producing an `AIAgentSubmission` that flows through governance.
 *
 * Provider packages (e.g. `@loop-engine/adapter-anthropic`,
 * `@loop-engine/adapter-openai`, `@loop-engine/adapter-gemini`,
 * `@loop-engine/adapter-grok`, `@loop-engine/adapter-vercel-ai`)
 * implement this interface. Adapters whose role is to answer queries
 * and return text + evidence (without acting as an autonomous actor)
 * implement `ToolAdapter` instead — see `./toolAdapter`.
 *
 * The four supporting types below (`AIAgentActor`, `AIAgentSubmission`,
 * `LoopActorPromptSignal`, `LoopActorPromptContext`) live in core
 * alongside the contract per D-13 first + second extensions
 * (PB-EX-01 + PB-EX-04): the contract surface must be closed under
 * its type graph, and core has no workspace dependency on
 * `@loop-engine/actors`.
 */

import type { ActorRef, SignalId } from "./schemas";

export interface AIAgentActor extends ActorRef {
  type: "ai-agent";
  modelId: string;
  provider: string;
  confidence?: number;
  promptHash?: string;
  toolsUsed?: string[];
}

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

export interface ActorAdapter {
  provider: string;
  model: string;
  createSubmission(context: LoopActorPromptContext): Promise<AIAgentSubmission>;
}

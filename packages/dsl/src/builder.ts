// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import {
  type ActorType,
  type GuardSpec,
  type LoopDefinition
} from "@loop-engine/core";
import { validateLoopDefinition } from "./schema";

type BuilderTransitionInput = {
  id: string;
  from: string;
  to: string;
  actors: ActorType[];
  guards?: Partial<GuardSpec>[];
};

export class LoopBuilder {
  private readonly _id: string;
  private readonly _domain: string;
  private _version = "1.0.0";
  private _description = "";
  private _states: Array<{ id: string; isTerminal?: boolean; isError?: boolean }> = [];
  private _initialState?: string;
  private _transitions: BuilderTransitionInput[] = [];
  private _outcome?: {
    id?: string;
    description?: string;
    valueUnit?: string;
    measurable?: boolean;
    businessMetrics?: Array<{
      id: string;
      label: string;
      unit: string;
      improvableByAI: boolean;
    }>;
  };

  private constructor(id: string, domain: string) {
    this._id = id;
    this._domain = domain;
  }

  static create(id: string, domain: string): LoopBuilder {
    return new LoopBuilder(id, domain);
  }

  version(v: string): LoopBuilder {
    this._version = v;
    return this;
  }

  description(d: string): LoopBuilder {
    this._description = d;
    return this;
  }

  state(id: string, options?: { isTerminal?: boolean; isError?: boolean }): LoopBuilder {
    this._states.push({ id, ...options });
    return this;
  }

  initialState(id: string): LoopBuilder {
    this._initialState = id;
    return this;
  }

  transition(spec: BuilderTransitionInput): LoopBuilder {
    if (!spec.actors || spec.actors.length === 0) {
      throw new Error(`transition ${spec.id} must have at least one actor`);
    }
    this._transitions.push(spec);
    return this;
  }

  outcome(spec: {
    id?: string;
    description?: string;
    valueUnit?: string;
    measurable?: boolean;
    businessMetrics?: Array<{
      id: string;
      label: string;
      unit: string;
      improvableByAI: boolean;
    }>;
  }): LoopBuilder {
    this._outcome = spec;
    return this;
  }

  build(): LoopDefinition {
    if (!this._outcome) {
      throw new Error("outcome is required");
    }
    const raw = {
      id: this._id,
      version: this._version,
      description: this._description || `${this._id} loop`,
      domain: this._domain,
      states: this._states.map((s) => ({
        id: s.id,
        isTerminal: s.isTerminal,
        isError: s.isError
      })),
      initialState: this._initialState,
      transitions: this._transitions.map((t) => ({
        id: t.id,
        from: t.from,
        to: t.to,
        allowedActors: t.actors,
        guards: t.guards?.map((g) => ({
          id: (g.id as string) ?? "custom_guard",
          description: g.description ?? "Guard",
          failureMessage: g.failureMessage ?? "Guard failed",
          severity: g.severity ?? "hard",
          evaluatedBy: g.evaluatedBy ?? "runtime"
        }))
      })),
      outcome: {
        id: (this._outcome.id as string) ?? "outcome",
        description: this._outcome.description ?? "Loop completed",
        valueUnit: this._outcome.valueUnit ?? "loop_completed",
        measurable: this._outcome.measurable ?? true,
        businessMetrics: this._outcome.businessMetrics
      }
    };

    const validated = validateLoopDefinition(raw);
    if (!validated.valid) {
      throw new Error(validated.errors.join("; "));
    }
    return validated.definition as LoopDefinition;
  }
}

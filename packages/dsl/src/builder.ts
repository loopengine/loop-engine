// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * LoopBuilder maps an example-friendly fluent API onto {@link LoopDefinitionSchema}.
 *
 * Schema follow-ups (not modeled in {@link StateSpecSchema}):
 * - `isError` on `.state()` is represented via `description: "Error terminal state"` only.
 *   See https://github.com/loopengine/loop-engine/issues (file if you need a first-class flag).
 */

import {
  LoopDefinitionSchema,
  type ActorType,
  type GuardSpec,
  type LoopDefinition,
  type OutcomeSpec,
  type StateSpec,
  type TransitionSpec
} from "@loop-engine/core";
import { validateLoopDefinition } from "./validator";

/** Full guard shape (matches `examples/ai-actors/shared/loop.ts`). */
export type LoopBuilderGuardLegacy = {
  id: string;
  severity: GuardSpec["severity"];
  evaluatedBy: GuardSpec["evaluatedBy"];
  description: string;
  failureMessage?: string;
};

/** Shorthand guard: `type` / `minimum` map into {@link GuardSpec.parameters}. */
export type LoopBuilderGuardShorthand = {
  id: string;
  type: string;
  minimum?: number;
  description?: string;
  severity?: GuardSpec["severity"];
  evaluatedBy?: GuardSpec["evaluatedBy"];
};

export type LoopBuilderGuardInput = LoopBuilderGuardLegacy | LoopBuilderGuardShorthand;

/** Authoring-time transition (maps to {@link TransitionSpec}). */
export type LoopBuilderTransitionInput = {
  id: string;
  from: string;
  to: string;
  /**
   * Accepts `human`, `automation`, `ai-agent`, `ai_agent`, or `system`
   * (`ai_agent` → `ai-agent`, `system` → `automation`).
   */
  actors: string[];
  guards?: LoopBuilderGuardInput[];
};

export type LoopBuilderOutcomeInput = {
  /** Folded into {@link OutcomeSpec.description} when present. */
  id?: string;
  description: string;
  valueUnit: string;
  measurable?: boolean;
  businessMetrics: OutcomeSpec["businessMetrics"];
};

type StateInput = {
  id: string;
  isTerminal?: boolean;
  /** No `isError` in StateSpec — see module docstring. */
  isError?: boolean;
};

const ACTOR_ALIASES: Record<string, ActorType> = {
  human: "human",
  automation: "automation",
  "ai-agent": "ai-agent",
  ai_agent: "ai-agent",
  system: "automation"
};

function normalizeActorType(raw: string): ActorType {
  const mapped = ACTOR_ALIASES[raw];
  if (mapped) {
    return mapped;
  }
  throw new Error(
    `LoopBuilder: unsupported actor "${raw}" (use human, automation, ai-agent, ai_agent, or system)`
  );
}

function isGuardLegacy(g: LoopBuilderGuardInput): g is LoopBuilderGuardLegacy {
  return (
    "severity" in g &&
    "evaluatedBy" in g &&
    typeof (g as LoopBuilderGuardLegacy).description === "string" &&
    typeof (g as LoopBuilderGuardLegacy).id === "string"
  );
}

function normalizeGuard(g: LoopBuilderGuardInput): GuardSpec {
  if (isGuardLegacy(g)) {
    const base: GuardSpec = {
      guardId: g.id as GuardSpec["guardId"],
      description: g.description,
      severity: g.severity,
      evaluatedBy: g.evaluatedBy
    };
    if (g.failureMessage !== undefined) {
      return { ...base, parameters: { failureMessage: g.failureMessage } };
    }
    return base;
  }

  const s = g as LoopBuilderGuardShorthand;
  const parameters: Record<string, unknown> = { type: s.type };
  if (s.minimum !== undefined) {
    parameters.minimum = s.minimum;
  }
  return {
    guardId: s.id as GuardSpec["guardId"],
    description: s.description ?? `Guard ${s.type}`,
    severity: s.severity ?? "hard",
    evaluatedBy: s.evaluatedBy ?? "external",
    parameters
  };
}

function normalizeGuards(guards: LoopBuilderGuardInput[] | undefined): GuardSpec[] | undefined {
  if (!guards || guards.length === 0) {
    return undefined;
  }
  return guards.map(normalizeGuard);
}

function normalizeTransitions(inputs: LoopBuilderTransitionInput[]): TransitionSpec[] {
  return inputs.map((t) => {
    const spec: TransitionSpec = {
      transitionId: t.id as TransitionSpec["transitionId"],
      from: t.from as TransitionSpec["from"],
      to: t.to as TransitionSpec["to"],
      signal: t.id as TransitionSpec["signal"],
      allowedActors: t.actors.map(normalizeActorType)
    };
    const guards = normalizeGuards(t.guards);
    if (guards !== undefined) {
      spec.guards = guards;
    }
    return spec;
  });
}

function normalizeStates(inputs: StateInput[]): StateSpec[] {
  return inputs.map((s) => {
    let description: string | undefined;
    if (s.isError) {
      description = "Error terminal state";
    }
    const spec: StateSpec = {
      stateId: s.id as StateSpec["stateId"],
      label: s.id.replace(/_/g, " ")
    };
    if (s.isTerminal !== undefined) {
      spec.terminal = s.isTerminal;
    }
    if (description !== undefined) {
      spec.description = description;
    }
    return spec;
  });
}

function deriveName(loopId: string): string {
  const segment = loopId.split(/[./]/).filter(Boolean).pop() ?? loopId;
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeOutcome(input: LoopBuilderOutcomeInput): OutcomeSpec {
  let description = input.description;
  if (input.id !== undefined && input.id.length > 0) {
    description = `[${input.id}] ${description}`;
  }
  if (input.measurable === true) {
    description = `${description} (measurable)`;
  }
  return {
    description,
    valueUnit: input.valueUnit,
    businessMetrics: input.businessMetrics
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
    return Object.freeze(obj) as T;
  }
  for (const key of Object.keys(obj as object)) {
    deepFreeze((obj as Record<string, unknown>)[key]);
  }
  return Object.freeze(obj as object) as T;
}

/**
 * Immutable fluent builder for {@link LoopDefinition}. Each chained method returns a new instance.
 *
 * Field mapping (authoring → schema):
 * - `create(loopId, domain)` → `loopId`, `tags: [domain]`
 * - transition `id` → `transitionId` **and** `signal` (same string)
 * - `actors` → `allowedActors` (aliases: `ai_agent`, `system`)
 * - guard `id` → `guardId`; shorthand `type`/`minimum` → `parameters`
 */
export class LoopBuilder {
  private constructor(
    private readonly loopId: string,
    private readonly domain: string,
    private readonly versionStr: string | undefined,
    private readonly nameStr: string | undefined,
    private readonly descriptionStr: string | undefined,
    private readonly stateInputs: readonly StateInput[],
    private readonly transitionInputs: readonly LoopBuilderTransitionInput[],
    private readonly initialStateId: string | undefined,
    private readonly outcomeInput: LoopBuilderOutcomeInput | undefined
  ) {}

  static create(loopId: string, domain: string): LoopBuilder {
    return new LoopBuilder(loopId, domain, undefined, undefined, undefined, [], [], undefined, undefined);
  }

  version(value: string): LoopBuilder {
    return new LoopBuilder(
      this.loopId,
      this.domain,
      value,
      this.nameStr,
      this.descriptionStr,
      this.stateInputs,
      this.transitionInputs,
      this.initialStateId,
      this.outcomeInput
    );
  }

  /**
   * Display name. If omitted, {@link build} derives a title from `loopId`
   * (the high-level `description` is set via `.description()`).
   */
  name(value: string): LoopBuilder {
    return new LoopBuilder(
      this.loopId,
      this.domain,
      this.versionStr,
      value,
      this.descriptionStr,
      this.stateInputs,
      this.transitionInputs,
      this.initialStateId,
      this.outcomeInput
    );
  }

  /** Human-readable loop description (maps to `LoopDefinition.description`). */
  description(value: string): LoopBuilder {
    return new LoopBuilder(
      this.loopId,
      this.domain,
      this.versionStr,
      this.nameStr,
      value,
      this.stateInputs,
      this.transitionInputs,
      this.initialStateId,
      this.outcomeInput
    );
  }

  state(id: string, opts?: { isTerminal?: boolean; isError?: boolean }): LoopBuilder {
    const next: StateInput = { id, ...opts };
    return new LoopBuilder(
      this.loopId,
      this.domain,
      this.versionStr,
      this.nameStr,
      this.descriptionStr,
      [...this.stateInputs, next],
      this.transitionInputs,
      this.initialStateId,
      this.outcomeInput
    );
  }

  initialState(id: string): LoopBuilder {
    return new LoopBuilder(
      this.loopId,
      this.domain,
      this.versionStr,
      this.nameStr,
      this.descriptionStr,
      this.stateInputs,
      this.transitionInputs,
      id,
      this.outcomeInput
    );
  }

  transition(spec: LoopBuilderTransitionInput): LoopBuilder {
    return new LoopBuilder(
      this.loopId,
      this.domain,
      this.versionStr,
      this.nameStr,
      this.descriptionStr,
      this.stateInputs,
      [...this.transitionInputs, spec],
      this.initialStateId,
      this.outcomeInput
    );
  }

  outcome(spec: LoopBuilderOutcomeInput): LoopBuilder {
    return new LoopBuilder(
      this.loopId,
      this.domain,
      this.versionStr,
      this.nameStr,
      this.descriptionStr,
      this.stateInputs,
      this.transitionInputs,
      this.initialStateId,
      spec
    );
  }

  build(): LoopDefinition {
    const ctx = `loopId=${this.loopId}`;

    if (this.versionStr === undefined || this.versionStr.length === 0) {
      throw new Error(`LoopBuilder: .version() is required before .build() (${ctx})`);
    }
    if (this.descriptionStr === undefined || this.descriptionStr.length === 0) {
      throw new Error(`LoopBuilder: .description() is required before .build() (${ctx})`);
    }
    if (this.stateInputs.length === 0) {
      throw new Error(`LoopBuilder: add at least one .state() before .build() (${ctx})`);
    }
    if (this.initialStateId === undefined) {
      throw new Error(`LoopBuilder: .initialState() is required before .build() (${ctx})`);
    }
    if (this.transitionInputs.length === 0) {
      throw new Error(`LoopBuilder: add at least one .transition() before .build() (${ctx})`);
    }

    const declared = new Set(this.stateInputs.map((s) => s.id));
    if (!declared.has(this.initialStateId)) {
      throw new Error(
        `LoopBuilder: initialState "${this.initialStateId}" was not declared with .state() (${ctx})`
      );
    }

    const resolvedName =
      this.nameStr !== undefined && this.nameStr.length > 0 ? this.nameStr : deriveName(this.loopId);

    let parsed: LoopDefinition;
    try {
      parsed = LoopDefinitionSchema.parse({
        loopId: this.loopId,
        version: this.versionStr,
        name: resolvedName,
        description: this.descriptionStr,
        states: normalizeStates([...this.stateInputs]),
        initialState: this.initialStateId,
        transitions: normalizeTransitions([...this.transitionInputs]),
        tags: [this.domain],
        outcome: this.outcomeInput !== undefined ? normalizeOutcome(this.outcomeInput) : undefined
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`LoopBuilder: schema parse failed (${ctx}): ${msg}`);
    }

    const checked = validateLoopDefinition(parsed);
    if (!checked.valid) {
      const detail = checked.errors.map((err) => `${err.path ?? "?"}: ${err.code} ${err.message}`).join("; ");
      throw new Error(`LoopBuilder: validateLoopDefinition failed (${ctx}): ${detail}`);
    }

    return deepFreeze(parsed);
  }
}

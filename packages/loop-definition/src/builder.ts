// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * LoopBuilder maps an example-friendly fluent API onto {@link LoopDefinitionSchema}.
 *
 * Per D-05, schema field names now match consumption-layer conventions
 * (`id`, `isTerminal`, `actors`, etc.), so the LoopBuilder normalize
 * functions construct objects whose shape is structurally identical to
 * the authoring input. The aliasing layer (`ACTOR_ALIASES`,
 * `normalizeGuard` legacy/shorthand split) remains in place pending
 * MECHANICAL 8.12 collapse.
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
  isError?: boolean;
};

const ACTOR_ALIASES: Record<string, ActorType> = {
  human: "human",
  automation: "automation",
  "ai-agent": "ai-agent",
  ai_agent: "ai-agent",
  system: "system"
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
      id: g.id as GuardSpec["id"],
      description: g.description,
      severity: g.severity,
      evaluatedBy: g.evaluatedBy
    };
    if (g.failureMessage !== undefined) {
      return { ...base, failureMessage: g.failureMessage };
    }
    return base;
  }

  const s = g as LoopBuilderGuardShorthand;
  const parameters: Record<string, unknown> = { type: s.type };
  if (s.minimum !== undefined) {
    parameters.minimum = s.minimum;
  }
  return {
    id: s.id as GuardSpec["id"],
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
    // PB-EX-05 Option B boundary site (LoopBuilder.build pre-fill):
    // signal := transition.id when authored signal is absent. Preserved
    // here so downstream (validator + engine) operate on a stable
    // SignalId without modification per the layered contract.
    const spec: TransitionSpec = {
      id: t.id as TransitionSpec["id"],
      from: t.from as TransitionSpec["from"],
      to: t.to as TransitionSpec["to"],
      signal: t.id as unknown as NonNullable<TransitionSpec["signal"]>,
      actors: t.actors.map(normalizeActorType)
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
    const spec: StateSpec = {
      id: s.id as StateSpec["id"],
      label: s.id.replace(/_/g, " ")
    };
    if (s.isTerminal !== undefined) {
      spec.isTerminal = s.isTerminal;
    }
    if (s.isError !== undefined) {
      spec.isError = s.isError;
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
  const spec: OutcomeSpec = {
    description: input.description,
    valueUnit: input.valueUnit,
    businessMetrics: input.businessMetrics
  };
  if (input.id !== undefined && input.id.length > 0) {
    spec.id = input.id as NonNullable<OutcomeSpec["id"]>;
  }
  if (input.measurable !== undefined) {
    spec.measurable = input.measurable;
  }
  return spec;
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
 * Field mapping (authoring → schema, post-D-05):
 * - `create(loopId, domain)` → `id`, `domain` (also retained in `tags: [domain]` for back-compat)
 * - transition `id` → `id`; `signal` auto-filled from `id` when omitted (PB-EX-05 Option B)
 * - `actors` → `actors` (aliases: `ai_agent` → `ai-agent`, `system` → `system`)
 * - guard `id` → `id`; shorthand `type`/`minimum` → `parameters`; `failureMessage` → `failureMessage`
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
        id: this.loopId,
        version: this.versionStr,
        name: resolvedName,
        description: this.descriptionStr,
        domain: this.domain,
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

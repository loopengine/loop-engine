// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * LoopBuilder — fluent authoring API for {@link LoopDefinition}.
 *
 * Post-D-05 + MECHANICAL 8.12: the aliasing layer that bridged legacy
 * authoring inputs to the pre-D-05 schema has been collapsed. Schema
 * field names now match consumption-layer conventions (`id`,
 * `isTerminal`, `actors`, etc.), so the builder passes typed inputs
 * through to {@link LoopDefinitionSchema} without string-form actor
 * aliases and without a guard-input legacy/shorthand split.
 *
 * The `signal := transition.id` defaulting at {@link LoopBuilder.build}
 * is NOT part of the collapsed aliasing layer. It is the
 * authoring→runtime boundary-defaulting marker for the PB-EX-05 Option B
 * layered contract. Post-SR-010 ratification, the canonical enforcement
 * site is the `.transform()` on `TransitionSpecSchema` itself; this
 * marker is retained as a defensive idempotent redundancy so readers
 * tracing the contract through the source tree see the boundary
 * explicitly at the authoring surface.
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

/**
 * Canonical guard input shape for {@link LoopBuilder}. Post-MECHANICAL
 * 8.12 collapse, this is the only accepted guard form — the legacy /
 * shorthand split is gone. `id` may be provided as a plain string; the
 * builder brand-casts it to {@link GuardSpec.id} during normalization.
 */
export type LoopBuilderGuardInput = Omit<GuardSpec, "id"> & { id: string };

/** Authoring-time transition (maps to {@link TransitionSpec}). */
export type LoopBuilderTransitionInput = {
  id: string;
  from: string;
  to: string;
  /**
   * Actors authorized to take this transition. Canonical {@link ActorType}
   * values only (`"human"`, `"automation"`, `"ai-agent"`, `"system"`).
   * Post-MECHANICAL 8.12 collapse: the `ai_agent` underscore alias is no
   * longer accepted — use `"ai-agent"`.
   */
  actors: ActorType[];
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

function normalizeGuard(g: LoopBuilderGuardInput): GuardSpec {
  const { id, ...rest } = g;
  return {
    ...rest,
    id: id as GuardSpec["id"]
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
    // PB-EX-05 Option B — defensive boundary marker (post-SR-010 ratification).
    // Canonical enforcement is the `.transform()` on TransitionSpecSchema at
    // the schema layer; this pre-fill is idempotent against that transform
    // and retained so the authoring→runtime boundary remains explicit at the
    // authoring surface.
    const spec: TransitionSpec = {
      id: t.id as TransitionSpec["id"],
      from: t.from as TransitionSpec["from"],
      to: t.to as TransitionSpec["to"],
      signal: t.id as unknown as NonNullable<TransitionSpec["signal"]>,
      actors: t.actors
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
 * Immutable fluent builder for {@link LoopDefinition}. Each chained method
 * returns a new instance.
 *
 * Field mapping (authoring → schema, post-D-05 + MECHANICAL 8.12):
 * - `create(loopId, domain)` → `id`, `domain` (also retained in `tags: [domain]` for back-compat)
 * - transition `id` → `id`; `signal` auto-filled from `id` via schema transform (PB-EX-05)
 * - `actors: ActorType[]` passes through typed (no string-form aliasing)
 * - `guards: LoopBuilderGuardInput[]` — canonical `GuardSpec`-shaped input with `id` as plain string
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

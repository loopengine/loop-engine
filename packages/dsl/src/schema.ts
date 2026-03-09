// @license MIT
// SPDX-License-Identifier: MIT
import {
  loopId,
  outcomeId,
  stateId,
  transitionId,
  type LoopDefinition
} from "@loopengine/core";
import { z } from "zod";

const semverRegex = /^\d+\.\d+\.\d+$/;

const BusinessMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().min(1),
  improvableByAI: z.boolean()
});

const GuardSpecSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  failureMessage: z.string().min(1),
  severity: z.enum(["hard", "soft"]),
  evaluatedBy: z.enum(["runtime", "module", "external"])
});

const SideEffectSpecSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  triggeredBy: z.string().min(1)
});

const TransitionSpecSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  allowedActors: z.array(z.enum(["human", "automation", "ai-agent", "webhook", "system"])).min(1),
  guards: z.array(GuardSpecSchema).optional(),
  sideEffects: z.array(SideEffectSpecSchema).optional(),
  description: z.string().optional()
});

const StateSpecSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  isTerminal: z.boolean().optional(),
  isError: z.boolean().optional()
});

const RawLoopDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(semverRegex, "version must be semver (x.y.z)"),
  description: z.string().min(1),
  domain: z.string().min(1),
  states: z.array(StateSpecSchema).min(1),
  initialState: z.string().min(1),
  transitions: z.array(TransitionSpecSchema),
  outcome: z.object({
    id: z.string().min(1),
    description: z.string().min(1),
    valueUnit: z.string().min(1),
    measurable: z.boolean(),
    businessMetrics: z.array(BusinessMetricSchema).optional()
  }),
  participants: z.array(z.string()).optional(),
  spawnableLoops: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

function toLoopDefinitionShape(input: z.infer<typeof RawLoopDefinitionSchema>): LoopDefinition {
  return {
    id: loopId(input.id),
    version: input.version,
    description: input.description,
    domain: input.domain,
    initialState: stateId(input.initialState),
    states: input.states.map((s) => ({
      id: stateId(s.id),
      ...(s.description !== undefined ? { description: s.description } : {}),
      ...(s.isTerminal !== undefined ? { isTerminal: s.isTerminal } : {}),
      ...(s.isError !== undefined ? { isError: s.isError } : {})
    })),
    transitions: input.transitions.map((t) => ({
      id: transitionId(t.id),
      from: stateId(t.from),
      to: stateId(t.to),
      allowedActors: t.allowedActors,
      ...(t.description !== undefined ? { description: t.description } : {}),
      ...(t.guards
        ? {
            guards: t.guards.map((g) => ({
              id: g.id as never,
              description: g.description,
              failureMessage: g.failureMessage,
              severity: g.severity,
              evaluatedBy: g.evaluatedBy
            }))
          }
        : {}),
      ...(t.sideEffects
        ? {
            sideEffects: t.sideEffects.map((s) => ({
              id: s.id,
              description: s.description,
              triggeredBy: transitionId(s.triggeredBy)
            }))
          }
        : {})
    })),
    outcome: {
      id: outcomeId(input.outcome.id),
      description: input.outcome.description,
      valueUnit: input.outcome.valueUnit,
      measurable: input.outcome.measurable,
      ...(input.outcome.businessMetrics ? { businessMetrics: input.outcome.businessMetrics } : {})
    },
    ...(input.participants ? { participants: input.participants } : {}),
    ...(input.spawnableLoops ? { spawnableLoops: input.spawnableLoops.map(loopId) } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

export const LoopDefinitionSchema = RawLoopDefinitionSchema.superRefine(
  (value, ctx) => {
    const stateIds = new Set(value.states.map((s) => s.id));
    if (!stateIds.has(value.initialState)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "initialState must exist in states",
        path: ["initialState"]
      });
    }

    const duplicateStates = value.states
      .map((s) => s.id)
      .filter((id, index, arr) => arr.indexOf(id) !== index);
    if (duplicateStates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate state ids: ${duplicateStates.join(", ")}`,
        path: ["states"]
      });
    }

    value.transitions.forEach((t, idx) => {
      if (!stateIds.has(t.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `transition.from references unknown state: ${t.from}`,
          path: ["transitions", idx, "from"]
        });
      }
      if (!stateIds.has(t.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `transition.to references unknown state: ${t.to}`,
          path: ["transitions", idx, "to"]
        });
      }
    });
  }
).transform((raw) => toLoopDefinitionShape(raw as z.infer<typeof RawLoopDefinitionSchema>));

export function validateLoopDefinition(
  input: unknown
): { valid: boolean; errors: string[]; definition?: LoopDefinition } {
  const result = LoopDefinitionSchema.safeParse(input);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message
      )
    };
  }
  return { valid: true, errors: [], definition: result.data };
}

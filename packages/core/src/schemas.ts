// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

export const LoopIdSchema = z.string().brand<"LoopId">();
export type LoopId = z.infer<typeof LoopIdSchema>;

export const AggregateIdSchema = z.string().brand<"AggregateId">();
export type AggregateId = z.infer<typeof AggregateIdSchema>;

export const ActorIdSchema = z.string().brand<"ActorId">();
export type ActorId = z.infer<typeof ActorIdSchema>;

export const SignalIdSchema = z.string().brand<"SignalId">();
export type SignalId = z.infer<typeof SignalIdSchema>;

export const GuardIdSchema = z.string().brand<"GuardId">();
export type GuardId = z.infer<typeof GuardIdSchema>;

export const StateIdSchema = z.string().brand<"StateId">();
export type StateId = z.infer<typeof StateIdSchema>;

export const TransitionIdSchema = z.string().brand<"TransitionId">();
export type TransitionId = z.infer<typeof TransitionIdSchema>;

export const OutcomeIdSchema = z.string().brand<"OutcomeId">();
export type OutcomeId = z.infer<typeof OutcomeIdSchema>;

export const CorrelationIdSchema = z.string().brand<"CorrelationId">();
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;

export const LoopStatusSchema = z.enum([
  "pending",
  "active",
  "completed",
  "failed",
  "cancelled",
  "suspended"
]);
export type LoopStatus = z.infer<typeof LoopStatusSchema>;

export const ActorTypeSchema = z.enum(["human", "automation", "ai-agent", "system"]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const ActorRefSchema = z.object({
  id: ActorIdSchema,
  type: ActorTypeSchema,
  displayName: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
export type ActorRef = z.infer<typeof ActorRefSchema>;

export const GuardSeveritySchema = z.enum(["hard", "soft"]);
export type GuardSeverity = z.infer<typeof GuardSeveritySchema>;

export const GuardSpecSchema = z.object({
  id: GuardIdSchema,
  description: z.string(),
  severity: GuardSeveritySchema,
  evaluatedBy: z.enum(["runtime", "module", "external"]),
  failureMessage: z.string().optional(),
  parameters: z.record(z.unknown()).optional()
});
export type GuardSpec = z.infer<typeof GuardSpecSchema>;

/**
 * Authoring-layer transition spec.
 *
 * `signal` is **optional at the authoring layer** per D-05 extension
 * (PB-EX-05 Option B). Wherever an authored `LoopDefinition` enters the
 * runtime, the boundary-defaulting contract applies: when authored `signal`
 * is absent, it is filled with `transition.id as SignalId`.
 *
 * The defaulting is implemented as a schema-level `.transform()` so that
 * the OUTPUT type (`z.infer<typeof TransitionSpecSchema>`, exported as
 * `TransitionSpec`) has `signal: SignalId` required. The INPUT type
 * (`z.input<typeof TransitionSpecSchema>`) keeps `signal?: SignalId`
 * optional. This satisfies the resolution's runtime-no-modification
 * promise: downstream consumers (validator uniqueness check, engine
 * `TransitionRecord` construction, event-stream consumers) operate on
 * `signal: SignalId` invariantly without per-site fallbacks.
 *
 * The two named enforcement sites in the D-05 extension —
 * `LoopBuilder.build()` (pre-parse fill, defensive) and parser-wrapper /
 * registry-adapter `applyAuthoringDefaults` calls (post-parse,
 * idempotent given the in-schema transform) — remain in place as public
 * authoring-API markers but are now superseded by this in-schema
 * boundary defaulting.
 *
 * See `API_SURFACE_DECISIONS_RESOLVED.md` §2 D-05 extension (PB-EX-05
 * Option B) for the full layered contract.
 */
export const TransitionSpecSchema = z
  .object({
    id: TransitionIdSchema,
    from: StateIdSchema,
    to: StateIdSchema,
    signal: SignalIdSchema.optional(),
    actors: z.array(ActorTypeSchema).min(1),
    guards: z.array(GuardSpecSchema).optional(),
    description: z.string().optional()
  })
  .transform((data) => ({
    ...data,
    signal: (data.signal ?? data.id) as unknown as z.infer<typeof SignalIdSchema>
  }));
export type TransitionSpec = z.infer<typeof TransitionSpecSchema>;

export const StateSpecSchema = z.object({
  id: StateIdSchema,
  label: z.string(),
  isTerminal: z.boolean().optional(),
  isError: z.boolean().optional(),
  description: z.string().optional()
});
export type StateSpec = z.infer<typeof StateSpecSchema>;

export const BusinessMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
  improvableByAI: z.boolean().optional()
});
export type BusinessMetric = z.infer<typeof BusinessMetricSchema>;

export const OutcomeSpecSchema = z.object({
  id: OutcomeIdSchema.optional(),
  description: z.string(),
  valueUnit: z.string(),
  measurable: z.boolean().optional(),
  businessMetrics: z.array(BusinessMetricSchema)
});
export type OutcomeSpec = z.infer<typeof OutcomeSpecSchema>;

export const LoopDefinitionSchema = z.object({
  id: LoopIdSchema,
  version: z.string(),
  name: z.string(),
  description: z.string(),
  domain: z.string().optional(),
  states: z.array(StateSpecSchema),
  initialState: StateIdSchema,
  transitions: z.array(TransitionSpecSchema),
  outcome: OutcomeSpecSchema.optional(),
  tags: z.array(z.string()).optional()
});
export type LoopDefinition = z.infer<typeof LoopDefinitionSchema>;

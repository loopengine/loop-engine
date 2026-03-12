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

export const LoopStatusSchema = z.enum([
  "pending",
  "active",
  "completed",
  "failed",
  "cancelled",
  "suspended"
]);
export type LoopStatus = z.infer<typeof LoopStatusSchema>;

export const ActorTypeSchema = z.enum(["human", "automation", "ai-agent"]);
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
  guardId: GuardIdSchema,
  description: z.string(),
  severity: GuardSeveritySchema,
  evaluatedBy: z.enum(["runtime", "module", "external"]),
  parameters: z.record(z.unknown()).optional()
});
export type GuardSpec = z.infer<typeof GuardSpecSchema>;

export const TransitionSpecSchema = z.object({
  transitionId: TransitionIdSchema,
  from: StateIdSchema,
  to: StateIdSchema,
  signal: SignalIdSchema,
  allowedActors: z.array(ActorTypeSchema).min(1),
  guards: z.array(GuardSpecSchema).optional(),
  description: z.string().optional()
});
export type TransitionSpec = z.infer<typeof TransitionSpecSchema>;

export const StateSpecSchema = z.object({
  stateId: StateIdSchema,
  label: z.string(),
  terminal: z.boolean().optional(),
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
  description: z.string(),
  valueUnit: z.string(),
  businessMetrics: z.array(BusinessMetricSchema)
});
export type OutcomeSpec = z.infer<typeof OutcomeSpecSchema>;

export const LoopDefinitionSchema = z.object({
  loopId: LoopIdSchema,
  version: z.string(),
  name: z.string(),
  description: z.string(),
  states: z.array(StateSpecSchema),
  initialState: StateIdSchema,
  transitions: z.array(TransitionSpecSchema),
  outcome: OutcomeSpecSchema.optional(),
  tags: z.array(z.string()).optional()
});
export type LoopDefinition = z.infer<typeof LoopDefinitionSchema>;

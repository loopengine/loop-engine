// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.
import type { ActorRef } from "@loop-engine/core";

export type IncidentSeverity = "critical" | "error" | "warning" | "info";

export interface ApprovalContext {
  loopId: string;
  loopName: string;
  actor: ActorRef;
  input: unknown;
  summary: string;
}

export type IncidentSeverityInput =
  | IncidentSeverity
  | ((context: ApprovalContext) => IncidentSeverity);

export interface PagerDutyNotifierOptions {
  integrationKey: string;
  severity?: IncidentSeverityInput;
  serviceContext?: string;
  approvalUrl?: (loopId: string) => string;
  customDetails?: (context: ApprovalContext) => Record<string, unknown>;
}

export interface PagerDutyLink {
  href: string;
  text: string;
}

export interface PagerDutyEventPayload {
  routing_key: string;
  event_action: "trigger" | "resolve";
  dedup_key: string;
  payload: {
    summary: string;
    severity: IncidentSeverity;
    source: string;
    custom_details?: Record<string, unknown>;
  };
  links?: PagerDutyLink[];
}

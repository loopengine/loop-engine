// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Better Data, Inc.
import type { ApprovalContext, IncidentSeverity, PagerDutyEventPayload, PagerDutyNotifierOptions } from "./types";

function getSeverity(options: PagerDutyNotifierOptions, context: ApprovalContext): IncidentSeverity {
  const configured = options.severity;
  if (typeof configured === "function") {
    return configured(context);
  }
  return configured ?? "warning";
}

export function buildDedupKey(loopId: string): string {
  return `loop-engine-${loopId}`;
}

export function buildTriggerPayload(
  options: PagerDutyNotifierOptions,
  loopId: string,
  context: ApprovalContext
): PagerDutyEventPayload {
  const dedupKey = buildDedupKey(loopId);
  const approvalLink = options.approvalUrl?.(loopId);

  return {
    routing_key: options.integrationKey,
    event_action: "trigger",
    dedup_key: dedupKey,
    payload: {
      summary: context.summary,
      severity: getSeverity(options, context),
      source: options.serviceContext ?? "Loop Engine",
      custom_details: {
        loop_id: loopId,
        loop_name: context.loopName,
        initiated_by: `${context.actor.type}:${String(context.actor.id)}`,
        approval_url: approvalLink ?? null,
        ...(options.customDetails?.(context) ?? {})
      }
    },
    links: approvalLink ? [{ href: approvalLink, text: "Approve or reject this action" }] : []
  };
}

export function buildResolvePayload(
  options: PagerDutyNotifierOptions,
  dedupKey: string,
  resolution: "approved" | "rejected"
): PagerDutyEventPayload {
  return {
    routing_key: options.integrationKey,
    event_action: "resolve",
    dedup_key: dedupKey,
    payload: {
      summary: `Loop ${dedupKey.replace(/^loop-engine-/, "")} ${resolution} by on-call engineer`,
      severity: "info",
      source: options.serviceContext ?? "Loop Engine"
    }
  };
}

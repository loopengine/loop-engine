import type { LoopEvent } from "@loop-engine/events";
import type { OpenClawGatewayRequest } from "./types";

export function formatEventMessage(
  event: LoopEvent,
  channel: string,
  target: string,
  approvalStates: string[],
  accountId?: string
): OpenClawGatewayRequest {
  const message = formatContent(event, approvalStates);
  return {
    type: "req",
    id: `loopengine-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    method: "send",
    params: {
      to: target,
      message,
      channel,
      ...(accountId ? { accountId } : {}),
      idempotencyKey: `${event.eventId}-${event.type}`
    }
  };
}

function formatContent(event: LoopEvent, approvalStates: string[]): string {
  switch (event.type) {
    case "loop.transition.executed": {
      const needsApproval = isApprovalState(String(event.toState), approvalStates);
      if (needsApproval) {
        return [
          `⚠️ Approval required: ${event.aggregateId}`,
          `Loop: ${event.loopId}`,
          `Action: ${event.transitionId}`,
          `Reply: approve ${event.aggregateId} | reject ${event.aggregateId}`
        ].join("\n");
      }
      return `🔄 ${event.loopId} -> ${event.toState} (${event.transitionId})`;
    }
    case "loop.completed":
      return `✅ Loop closed: ${event.aggregateId}\nOutcome: ${event.outcomeId}`;
    case "loop.guard.failed":
      return `❌ Guard failed: ${event.aggregateId}\nGuard: ${event.guardId}\n${event.guardFailureMessage}`;
    case "loop.started":
      return `🚀 Loop started: ${event.aggregateId}\nType: ${event.loopId}`;
    default:
      return `[loop-engine] ${event.type}: ${event.aggregateId}`;
  }
}

export function isApprovalState(state: string, configured: string[]): boolean {
  if (configured.length > 0) return configured.includes(state);
  return /PENDING|APPROVAL/i.test(state);
}

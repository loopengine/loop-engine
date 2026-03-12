import type { PagerDutyNotifier } from "./pagerduty-notifier";

export function shouldResolveForState(state: string): boolean {
  return !/PENDING_HUMAN_APPROVAL/i.test(state);
}

export async function resolveOnLoopExit(
  notifier: PagerDutyNotifier,
  dedupKey: string,
  newState: string,
  resolution: "approved" | "rejected"
): Promise<void> {
  if (!shouldResolveForState(newState)) return;
  await notifier.resolve(dedupKey, resolution);
}

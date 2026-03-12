import { buildResolvePayload, buildTriggerPayload } from "./incident-builder";
import type { ApprovalContext, PagerDutyEventPayload, PagerDutyNotifierOptions } from "./types";

const PAGERDUTY_EVENTS_API = "https://events.pagerduty.com/v2/enqueue";

export class PagerDutyNotifier {
  constructor(private readonly options: PagerDutyNotifierOptions) {}

  async notify(loopId: string, context: ApprovalContext): Promise<string> {
    const payload = buildTriggerPayload(this.options, loopId, context);
    await this.enqueue(payload);
    return payload.dedup_key;
  }

  async resolve(dedupKey: string, resolution: "approved" | "rejected"): Promise<void> {
    const payload = buildResolvePayload(this.options, dedupKey, resolution);
    await this.enqueue(payload);
  }

  private async enqueue(payload: PagerDutyEventPayload): Promise<void> {
    const response = await fetch(PAGERDUTY_EVENTS_API, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(
        `[@loop-engine/adapter-pagerduty] Events API request failed: ${response.status} ${response.statusText}`
      );
    }
  }
}

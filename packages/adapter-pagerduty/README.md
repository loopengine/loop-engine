# @loop-engine/adapter-pagerduty

`@loop-engine/adapter-pagerduty` sends Loop Engine approval-required actions to PagerDuty as Events API v2 incidents.

## Install

```bash
npm install @loop-engine/adapter-pagerduty
```

## Trigger an incident for approval

```ts
import { PagerDutyNotifier } from "@loop-engine/adapter-pagerduty";

const pagerduty = new PagerDutyNotifier({
  integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY!,
  severity: "warning",
  serviceContext: "Loop Engine / Procurement Agent",
  approvalUrl: (loopId) => `https://app.betterdata.co/loops/${loopId}`
});

const dedupKey = await pagerduty.notify("loop_po_0017", {
  loopId: "loop_po_0017",
  loopName: "purchase-order",
  actor: { type: "ai-agent", id: "procurement-agent" as never },
  input: { vendor: "Acme Medical Devices", amount: 9200 },
  summary: "AI requested $9,200 PO to Acme Medical Devices"
});
```

## Resolve incident after decision

```ts
await pagerduty.resolve(dedupKey, "approved");
```

## Events API endpoint

This package posts directly to `https://events.pagerduty.com/v2/enqueue` with `trigger` and `resolve` events and a stable dedup key (`loop-engine-${loopId}`).

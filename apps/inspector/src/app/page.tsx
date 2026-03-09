"use client";

import { useMemo, useState } from "react";
import { buildTimeline, computeMetrics } from "@loopengine/observability";
import type { LoopInstance, TransitionRecord } from "@loopengine/core";
import { DevtoolsPanel } from "@loopengine/ui-devtools";

const sampleInstance: LoopInstance = {
  loopId: "scm.procurement" as never,
  aggregateId: "PO-2026-0012" as never,
  orgId: "acme",
  currentState: "INVOICE_MATCHED" as never,
  status: "IN_PROGRESS",
  startedAt: "2026-03-01T08:00:00.000Z",
  correlationId: "corr-1" as never
};

const sampleHistory: TransitionRecord[] = [
  {
    id: "t1",
    loopId: "scm.procurement" as never,
    aggregateId: "PO-2026-0012" as never,
    transitionId: "confirm_po" as never,
    fromState: "OPEN" as never,
    toState: "PO_CONFIRMED" as never,
    actor: { type: "human", id: "buyer@example.com" as never },
    evidence: { approved: true },
    occurredAt: "2026-03-01T08:05:00.000Z"
  },
  {
    id: "t2",
    loopId: "scm.procurement" as never,
    aggregateId: "PO-2026-0012" as never,
    transitionId: "schedule_receipt" as never,
    fromState: "PO_CONFIRMED" as never,
    toState: "RECEIPT_SCHEDULED" as never,
    actor: { type: "automation", id: "system:procurement" as never },
    evidence: {},
    occurredAt: "2026-03-01T08:09:00.000Z"
  }
];

export default function Page(): React.ReactElement {
  const [apiUrl, setApiUrl] = useState("http://localhost:3001");
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"timeline" | "diagram" | "metrics" | "raw">("timeline");

  const timeline = useMemo(() => buildTimeline(sampleInstance, sampleHistory), []);
  const metrics = useMemo(
    () =>
      computeMetrics([sampleInstance], sampleHistory, {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z"
      }),
    []
  );
  const filteredHistory = sampleHistory.filter((t) =>
    `${t.transitionId} ${t.fromState} ${t.toState}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h1>Loop Inspector</h1>
      <section style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={apiUrl}
          onChange={(e) => setApiUrl(String((e.target as any).value ?? ""))}
          style={{ minWidth: 320 }}
        />
        <button type="button" onClick={() => setConnected(true)}>
          Connect
        </button>
        <span>{connected ? "CONNECTED" : "DISCONNECTED"}</span>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "28% 72%", gap: 12 }}>
        <aside style={{ border: "1px solid #ddd", padding: 8 }}>
          <h2>Loop Instances</h2>
          <input
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(String((e.target as any).value ?? ""))}
            style={{ width: "100%" }}
          />
          <ul>
            <li>
              {sampleInstance.aggregateId} - {sampleInstance.loopId} - {sampleInstance.currentState}
            </li>
          </ul>
        </aside>

        <section style={{ border: "1px solid #ddd", padding: 8 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={() => setTab("timeline")}>
              Timeline
            </button>
            <button type="button" onClick={() => setTab("diagram")}>
              State Diagram
            </button>
            <button type="button" onClick={() => setTab("metrics")}>
              Metrics
            </button>
            <button type="button" onClick={() => setTab("raw")}>
              Raw Events
            </button>
          </div>

          {tab === "timeline" && (
            <div>
              <h3>Timeline</h3>
              {filteredHistory.map((t) => (
                <div key={t.id} style={{ marginBottom: 8 }}>
                  {t.fromState} -&gt; {t.toState} ({t.actor.type}:{String(t.actor.id)}) at {t.occurredAt}
                </div>
              ))}
              <p>Current state: {timeline.instance.currentState}</p>
            </div>
          )}

          {tab === "diagram" && (
            <div>
              <h3>State Diagram (simplified)</h3>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                SIGNAL -&gt; OPEN -&gt; PO_CONFIRMED -&gt; RECEIPT_SCHEDULED -&gt; INVOICE_MATCHED -&gt; CLOSED
              </pre>
            </div>
          )}

          {tab === "metrics" && (
            <div>
              <h3>Metrics (30d)</h3>
              <p>Total instances: {metrics.totalInstances}</p>
              <p>Completion rate: {metrics.completionRate}</p>
              <p>Avg duration ms: {metrics.avgDurationMs}</p>
              <p>Guard failure rate: {metrics.guardFailureRate}</p>
            </div>
          )}

          {tab === "raw" && (
            <div>
              <h3>Raw Events</h3>
              {sampleHistory.map((h) => (
                <pre key={h.id}>{JSON.stringify(h, null, 2)}</pre>
              ))}
            </div>
          )}
        </section>
      </div>

      <section style={{ marginTop: 12 }}>
        <h2>Learning Signals</h2>
        <p>Predicted vs actual metrics view appears when loop is closed.</p>
      </section>
      <DevtoolsPanel aggregateId={String(sampleInstance.aggregateId)} apiUrl={apiUrl} />
    </main>
  );
}

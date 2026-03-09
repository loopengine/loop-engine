"use client";

import { useMemo, useState } from "react";
import { parseLoopYaml } from "@loopengine/dsl";
import { createLoopSystem } from "@loopengine/sdk";
import { DevtoolsPanel } from "@loopengine/ui-devtools";

const procurementYaml = `id: scm.procurement
version: 1.0.0
domain: scm
description: Procurement playground definition
states:
  - id: OPEN
  - id: PO_CONFIRMED
  - id: CLOSED
    isTerminal: true
initialState: OPEN
transitions:
  - id: confirm_po
    from: OPEN
    to: PO_CONFIRMED
    allowedActors: [human, automation, ai-agent]
  - id: close
    from: PO_CONFIRMED
    to: CLOSED
    allowedActors: [human]
outcome:
  id: po_settled
  description: PO settled
  valueUnit: po_settled
  measurable: true
`;

type EventItem = { type: string; occurredAt: string; payload: unknown };

export default function Page(): React.ReactElement {
  const [yaml, setYaml] = useState(procurementYaml);
  const [aggregateId, setAggregateId] = useState("DEMO-001");
  const [state, setState] = useState("NOT_STARTED");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentLoopId, setCurrentLoopId] = useState("scm.procurement");
  const [currentTransitions, setCurrentTransitions] = useState<string[]>([]);

  const definition = useMemo(() => {
    try {
      const parsed = parseLoopYaml(yaml);
      setValidationError(null);
      return parsed;
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Invalid YAML");
      return null;
    }
  }, [yaml]);

  const runStart = async (): Promise<void> => {
    if (!definition) return;
    const system = createLoopSystem({ loops: [definition] });
    system.eventBus.subscribe(async (event) => {
      setEvents((prev) => [{ type: (event as { type: string }).type, occurredAt: new Date().toISOString(), payload: event }, ...prev]);
    });
    await system.engine.start({
      loopId: definition.id as never,
      aggregateId: aggregateId as never,
      orgId: "demo-org",
      actor: { type: "human", id: "user@example.com" }
    });
    const loopState = await system.engine.getState(aggregateId as never);
    setState(String(loopState?.currentState ?? "UNKNOWN"));
    setCurrentLoopId(String(definition.id));
    const transitions = definition.transitions.filter((t) => t.from === loopState?.currentState);
    setCurrentTransitions(transitions.map((t) => String(t.id)));
  };

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h1>Loop Engine Playground</h1>
      <p>Zero-config local sandbox for loop definitions and execution.</p>
      <div style={{ display: "grid", gridTemplateColumns: "40% 35% 25%", gap: 12 }}>
        <section>
          <h2>Loop Definition Editor</h2>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(String((e.target as any).value ?? ""))}
            rows={24}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
          <button type="button" onClick={() => void 0}>
            Validate
          </button>
          {validationError ? <p style={{ color: "red" }}>{validationError}</p> : <p>Definition valid.</p>}
        </section>
        <section>
          <h2>Loop Executor</h2>
          <label>
            Aggregate ID{" "}
            <input
              value={aggregateId}
              onChange={(e) => setAggregateId(String((e.target as any).value ?? ""))}
            />
          </label>
          <div>
            <button type="button" onClick={() => void runStart()} disabled={!definition}>
              Start loop
            </button>
          </div>
          <p>
            Current loop: <strong>{currentLoopId}</strong>
          </p>
          <p>
            Current state: <strong>{state}</strong>
          </p>
          <h3>Available transitions</h3>
          <ul>
            {currentTransitions.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Event Stream</h2>
          <button type="button" onClick={() => setEvents([])}>
            Clear
          </button>
          <div style={{ maxHeight: 500, overflowY: "auto", border: "1px solid #ddd", padding: 8 }}>
            {events.map((event, idx) => (
              <details key={`${event.type}-${idx}`} style={{ marginBottom: 8 }}>
                <summary>
                  {event.type} - {event.occurredAt}
                </summary>
                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
              </details>
            ))}
          </div>
        </section>
      </div>
      <DevtoolsPanel apiUrl="http://localhost:3010" />
    </main>
  );
}

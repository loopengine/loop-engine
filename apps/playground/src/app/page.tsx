"use client";

import { useMemo, useState } from "react";
import { parseLoopYaml } from "@loop-engine/loop-definition";
import { InMemoryEventBus } from "@loop-engine/events";
import { GuardRegistry } from "@loop-engine/guards";
import { createLoopEngine } from "@loop-engine/runtime";
import { DevtoolsPanel } from "@loop-engine/ui-devtools";

const procurementYaml = `loopId: scm.procurement
version: 1.0.0
name: scm.procurement
description: Procurement playground definition
states:
  - stateId: OPEN
    label: Open
  - stateId: PO_CONFIRMED
    label: PO Confirmed
  - stateId: CLOSED
    label: Closed
    terminal: true
initialState: OPEN
transitions:
  - transitionId: confirm_po
    signal: scm.confirm_po
    from: OPEN
    to: PO_CONFIRMED
    allowedActors: [human, automation, ai-agent]
  - transitionId: close
    signal: scm.close
    from: PO_CONFIRMED
    to: CLOSED
    allowedActors: [human]
outcome:
  description: PO settled
  valueUnit: po_settled
  businessMetrics:
    - id: cycle_time_days
      label: Cycle Time
      unit: days
`;

type EventItem = { type: string; occurredAt: string; payload: unknown };

class InMemoryLoopRegistry {
  constructor(private readonly loops: any[]) {}
  get(id: any): any {
    return this.loops.find((loop) => loop.id === id);
  }
  list(): any[] {
    return this.loops;
  }
}

class InMemoryLoopStore {
  private readonly instances = new Map<string, any>();
  private readonly history = new Map<string, any[]>();

  async getInstance(aggregateId: any): Promise<any | null> {
    return this.instances.get(String(aggregateId)) ?? null;
  }

  async saveInstance(instance: any): Promise<void> {
    this.instances.set(String(instance.aggregateId), instance);
  }

  async getTransitionHistory(aggregateId: any): Promise<any[]> {
    return this.history.get(String(aggregateId)) ?? [];
  }

  async saveTransitionRecord(record: any): Promise<void> {
    const key = String(record.aggregateId);
    const current = this.history.get(key) ?? [];
    this.history.set(key, [...current, record]);
  }

  async listOpenInstances(loopId: any): Promise<any[]> {
    return [...this.instances.values()].filter((instance) => instance.loopId === loopId && instance.status === "active");
  }
}

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
    const eventBus = new InMemoryEventBus();
    const guardRegistry = new GuardRegistry();
    guardRegistry.registerBuiltIns();
    const system = createLoopEngine({
      registry: new InMemoryLoopRegistry([definition]),
      store: new InMemoryLoopStore(),
      eventBus,
      guardRegistry
    });
    eventBus.subscribe(async (event) => {
      setEvents((prev) => [{ type: (event as { type: string }).type, occurredAt: new Date().toISOString(), payload: event }, ...prev]);
    });
    await system.start({
      loopId: definition.id as never,
      aggregateId: aggregateId as never,
      actor: { type: "human", id: "user@example.com" as never }
    });
    const loopState = await system.getState(aggregateId as never);
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

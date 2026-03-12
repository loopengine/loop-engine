// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopDefinition, StateId, TransitionId } from "@loop-engine/core";

export function StateDiagram({
  definition,
  currentState,
  completedTransitions = []
}: {
  definition: LoopDefinition;
  currentState?: StateId;
  completedTransitions?: TransitionId[];
}): React.ReactElement {
  const width = 760;
  const gap = Math.max(1, Math.floor(width / Math.max(1, definition.states.length)));
  return (
    <svg width="100%" viewBox={`0 0 ${width} 180`} className="rounded border bg-white">
      {definition.transitions.map((t, idx) => {
        const fromIdx = definition.states.findIndex((state) => state.stateId === t.from);
        const toIdx = definition.states.findIndex((state) => state.stateId === t.to);
        const x1 = 40 + fromIdx * gap;
        const x2 = 40 + toIdx * gap;
        const y = 110 + (idx % 2) * 12;
        const completed = completedTransitions.includes(t.transitionId);
        return (
          <line
            key={`${String(t.transitionId)}-${idx}`}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke={completed ? "#2563eb" : "#9ca3af"}
            strokeWidth={2}
            strokeDasharray={completed ? "0" : "6 4"}
          />
        );
      })}
      {definition.states.map((s, idx) => {
        const x = 40 + idx * gap;
        const isCurrent = currentState === s.stateId;
        return (
          <g key={String(s.stateId)}>
            <circle cx={x} cy={70} r={22} fill={isCurrent ? "#10b981" : "#e5e7eb"} stroke="#374151" />
            {isCurrent ? <circle cx={x} cy={70} r={28} fill="none" stroke="#10b981" strokeWidth={2} /> : null}
            <text x={x} y={74} textAnchor="middle" fontSize="9">
              {String(s.stateId)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

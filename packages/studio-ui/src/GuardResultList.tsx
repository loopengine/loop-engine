// SPDX-License-Identifier: Apache-2.0

export type GuardResult = {
  guardId: string;
  passed: boolean;
  reason?: string;
};

export type GuardResultListProps = {
  guards: GuardResult[];
  className?: string;
};

export function GuardResultList({ guards, className = "" }: GuardResultListProps) {
  if (guards.length === 0) {
    return <p className={`le-studio le-studio-muted ${className}`.trim()}>No guard evaluations</p>;
  }

  return (
    <ul className={`le-studio le-studio-list ${className}`.trim()} aria-label="Guard results">
      {guards.map((g) => (
        <li key={g.guardId}>
          <span
            className={`le-studio-badge ${g.passed ? "" : "le-studio-badge--blocked"}`.trim()}
            style={g.passed ? { borderColor: "var(--le-studio-success)", color: "var(--le-studio-success)" } : undefined}
          >
            {g.passed ? "PASS" : "FAIL"}
          </span>{" "}
          <code style={{ fontSize: "0.8125rem" }}>{g.guardId}</code>
          {g.reason ? <span className="le-studio-muted"> — {g.reason}</span> : null}
        </li>
      ))}
    </ul>
  );
}

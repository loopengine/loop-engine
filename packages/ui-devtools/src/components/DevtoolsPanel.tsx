// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";

export function DevtoolsPanel({
  getLoopHistory,
  apiUrl
}: {
  getLoopHistory?: (aggregateId: string) => Promise<unknown>;
  apiUrl?: string;
}): React.ReactElement | null {
  const [aggregateId, setAggregateId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const load = async (): Promise<void> => {
    if (!aggregateId) return;
    if (getLoopHistory) {
      setResult(await getLoopHistory(aggregateId));
      return;
    }
    if (apiUrl) {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/loops/${encodeURIComponent(aggregateId)}/history`);
      setResult(await response.json());
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 rounded border bg-white p-3 shadow-lg">
      <div className="mb-2 text-sm font-medium">Loop Devtools</div>
      <div className="flex gap-2">
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          value={aggregateId}
          onChange={(e) => setAggregateId((e.target as any).value ?? "")}
          placeholder="aggregateId"
        />
        <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => void load()}>
          Load
        </button>
      </div>
      {result ? <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

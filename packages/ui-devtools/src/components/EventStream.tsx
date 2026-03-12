// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { LoopEvent } from "@loop-engine/events";

export function EventStream({
  events,
  maxVisible = 50,
  onClear
}: {
  events: LoopEvent[];
  maxVisible?: number;
  onClear?: () => void;
}): React.ReactElement {
  const shown = events.slice(0, maxVisible);
  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium">Events</h3>
        {onClear ? (
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {shown.map((event, idx) => (
          <details key={`${event.eventId}-${idx}`} className="rounded bg-gray-50 p-2">
            <summary className="cursor-pointer text-sm">
              {event.type} - {event.occurredAt}
            </summary>
            <pre className="mt-1 overflow-auto text-xs">{JSON.stringify(event, null, 2)}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}

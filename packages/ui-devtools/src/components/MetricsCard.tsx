// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopMetrics } from "@loop-engine/observability";

function Item({ label, value }: { label: string; value: string | number }): React.ReactElement {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function MetricsCard({ metrics }: { metrics: LoopMetrics }): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Item label="Completion Rate" value={metrics.completionRate.toFixed(2)} />
      <Item label="Avg Duration (ms)" value={Math.round(metrics.avgDurationMs)} />
      <Item label="Guard Failure Rate" value={metrics.guardFailureRate.toFixed(2)} />
      <Item label="AI Actor Rate" value={metrics.aiActorRate.toFixed(2)} />
      <Item label="Human Actor Rate" value={metrics.humanActorRate.toFixed(2)} />
      <Item label="Avg Transition Count" value={metrics.avgTransitionCount.toFixed(2)} />
    </div>
  );
}

// @license MIT
// SPDX-License-Identifier: MIT
import type { LoopTimeline as LoopTimelineType } from "@loopengine/observability";
import { ActorBadge } from "./ActorBadge";
import { LoopStateBadge } from "./LoopStateBadge";

export function LoopTimeline({
  timeline,
  showEvidence = true,
  compact = false
}: {
  timeline: LoopTimelineType;
  showEvidence?: boolean;
  compact?: boolean;
}): React.ReactElement {
  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto">
        {timeline.transitions.map((t) => (
          <span key={t.id} className="h-3 w-3 rounded-full bg-blue-500" title={String(t.transitionId)} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.transitions.map((transition) => (
        <div key={transition.id} className="rounded border p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">
              {String(transition.fromState)} {"->"} {String(transition.toState)}
            </div>
            <ActorBadge actor={transition.actor} size="sm" />
          </div>
          <div className="mt-1 text-xs text-gray-600">{transition.occurredAt}</div>
          {showEvidence ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">Evidence</summary>
              <pre className="mt-1 overflow-auto text-xs">{JSON.stringify(transition.evidence, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      ))}
      <div className="pt-2">
        <LoopStateBadge state={String(timeline.instance.currentState)} />
      </div>
    </div>
  );
}

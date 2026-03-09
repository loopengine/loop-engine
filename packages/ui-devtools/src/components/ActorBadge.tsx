// @license MIT
// SPDX-License-Identifier: MIT
import type { ActorRef } from "@loop-engine/core";

function color(type: ActorRef["type"]): string {
  switch (type) {
    case "human":
      return "bg-indigo-100 text-indigo-800";
    case "automation":
      return "bg-cyan-100 text-cyan-800";
    case "ai-agent":
      return "bg-violet-100 text-violet-800";
    case "system":
      return "bg-gray-200 text-gray-800";
    case "webhook":
      return "bg-amber-100 text-amber-800";
  }
}

export function ActorBadge({
  actor,
  size = "md"
}: {
  actor: ActorRef;
  size?: "sm" | "md";
}): React.ReactElement {
  const padded = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2 py-1";
  const id = String(actor.id);
  const short = id.length > 24 ? `${id.slice(0, 21)}...` : id;
  return (
    <span className={`inline-flex items-center rounded ${padded} ${color(actor.type)}`}>
      {actor.type}:{short}
    </span>
  );
}

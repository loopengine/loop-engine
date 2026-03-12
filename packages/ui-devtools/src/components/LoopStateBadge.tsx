// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
type BadgeSize = "xs" | "sm" | "md" | "lg";

const sizeClass: Record<BadgeSize, string> = {
  xs: "text-xs px-1 py-0.5",
  sm: "text-sm px-2 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1"
};

function stateClass(state: string): string {
  switch (state) {
    case "OPEN":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-amber-100 text-amber-800";
    case "CLOSED":
      return "bg-green-100 text-green-800";
    case "ERROR":
      return "bg-red-100 text-red-800";
    case "CANCELLED":
      return "bg-gray-200 text-gray-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function LoopStateBadge({
  state,
  size = "md"
}: {
  state: string;
  size?: BadgeSize;
}): React.ReactElement {
  return (
    <span className={`inline-flex rounded font-medium ${sizeClass[size]} ${stateClass(state)}`}>
      {state}
    </span>
  );
}

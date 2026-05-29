// SPDX-License-Identifier: Apache-2.0

import { actorTypeLabel } from "./utils.js";

export type ActorAttributionProps = {
  id: string;
  type: string;
  className?: string;
};

export function ActorAttribution({ id, type, className = "" }: ActorAttributionProps) {
  return (
    <span className={`le-studio ${className}`.trim()} title={id}>
      <span className="le-studio-badge">{actorTypeLabel(type)}</span>{" "}
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>{id}</span>
    </span>
  );
}

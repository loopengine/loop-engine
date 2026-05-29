// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react";

export type StudioViewStatus = "loading" | "empty" | "error" | "ready";

export type StudioStateFrameProps = {
  status: StudioViewStatus;
  /** Shown when status is `empty` */
  emptyLabel?: string;
  /** Shown when status is `error` */
  errorMessage?: string;
  children?: ReactNode;
  className?: string;
};

export function StudioStateFrame({
  status,
  emptyLabel = "No data",
  errorMessage = "Something went wrong",
  children,
  className = "",
}: StudioStateFrameProps) {
  if (status === "loading") {
    return (
      <div className={`le-studio le-studio-state-frame ${className}`.trim()} role="status">
        Loading…
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className={`le-studio le-studio-state-frame ${className}`.trim()} role="status">
        {emptyLabel}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className={`le-studio le-studio-state-frame le-studio-state-frame--error ${className}`.trim()}
        role="alert"
      >
        {errorMessage}
      </div>
    );
  }

  return <div className={`le-studio ${className}`.trim()}>{children}</div>;
}

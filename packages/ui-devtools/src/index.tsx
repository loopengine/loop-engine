// @license MIT
// SPDX-License-Identifier: MIT
type DevtoolsPanelProps = {
  aggregateId?: string;
  apiUrl?: string;
};

export function DevtoolsPanel(props: DevtoolsPanelProps): null {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }
  void props;
  return null;
}

// SPDX-License-Identifier: Apache-2.0

/** RT-11 runtime connection catalog ids (frozen by RT-12–14). */
export const CHANNEL_SLACK_CONNECTION_ID = "channel.slack";
export const INTEGRATION_GOOGLE_DOCS_CONNECTION_ID = "integration.google_docs";
export const INTEGRATION_GOOGLE_SHEETS_CONNECTION_ID = "integration.google_sheets";

export const DUAL_SURFACE_LOOP_PREFIX = "dual-surface.";

export function isDualSurfaceLoop(loopId: string): boolean {
  return loopId.startsWith(DUAL_SURFACE_LOOP_PREFIX);
}

// SPDX-License-Identifier: Apache-2.0

/**
 * Slack web client permalink from workspace pointers (DS-08 — no secrets).
 * Format: app.slack.com/client/{team}/{channel}/p{ts_without_dot}
 */
export function slackWebClientPermalink(
  slackTeamId: string,
  channelId: string,
  messageTs: string,
): string {
  const p = messageTs.replace(/\./g, "");
  return `https://app.slack.com/client/${slackTeamId}/${channelId}/p${p}`;
}

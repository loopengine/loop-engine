// SPDX-License-Identifier: Apache-2.0

export function formatIsoTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString();
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) {
    return "—";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export function actorTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

// Copyright (c) Better Data, Inc. and contributors
// SPDX-License-Identifier: Apache-2.0

export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Parse a single raw SSE frame (the text between blank-line separators) per the
 * EventSource wire format: `event:`/`data:` fields, optional leading space after
 * the colon, multiple `data:` lines joined by `\n`, `:`-prefixed comment lines
 * ignored. Returns null for a frame with no data.
 */
export function parseSseFrame(raw: string): SseFrame | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Async-iterate SSE frames from a byte stream, buffering across chunk
 * boundaries. Normalizes CRLF so it tolerates either separator.
 */
export async function* iterateSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const frame = parseSseFrame(raw);
        if (frame) yield frame;
        sep = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim() !== "") {
      const frame = parseSseFrame(buffer);
      if (frame) yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}

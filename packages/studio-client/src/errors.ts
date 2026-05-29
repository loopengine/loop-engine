// SPDX-License-Identifier: Apache-2.0

export type StudioClientErrorCode =
  | "network"
  | "http"
  | "not_found"
  | "trace_disabled"
  | "contract_mismatch"
  | "parse";

export class StudioClientError extends Error {
  readonly code: StudioClientErrorCode;
  readonly status?: number;
  readonly body?: unknown;

  constructor(
    code: StudioClientErrorCode,
    message: string,
    options?: { status?: number; body?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "StudioClientError";
    this.code = code;
    this.status = options?.status;
    this.body = options?.body;
  }
}

export function mapHttpStatusToStudioError(status: number, body: unknown): StudioClientError {
  if (status === 404) {
    return new StudioClientError("not_found", "Run not found", { status, body });
  }
  if (status === 503) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Trace API disabled";
    return new StudioClientError("trace_disabled", msg, { status, body });
  }
  return new StudioClientError("http", `HTTP ${status}`, { status, body });
}

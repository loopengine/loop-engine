// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

export class PerplexityAdapterError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "PerplexityAdapterError";
  }
}

export class RateLimitError extends PerplexityAdapterError {
  constructor(message: string) {
    super(message, 429, true);
    this.name = "RateLimitError";
  }
}

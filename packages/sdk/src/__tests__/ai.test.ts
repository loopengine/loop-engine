// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from "vitest";

describe("createAIActor", () => {
  it("throws a helpful message when provider SDK is missing", async () => {
    vi.resetModules();

    const requireMock = Object.assign(
      vi.fn((moduleName: string) => {
        throw new Error(`unexpected module load: ${moduleName}`);
      }),
      {
        resolve: vi.fn((moduleName: string) => {
          if (moduleName === "@anthropic-ai/sdk") {
            const error = new Error(`Cannot find module '${moduleName}'`) as Error & {
              code?: string;
            };
            error.code = "MODULE_NOT_FOUND";
            throw error;
          }
          return `/resolved/${moduleName}`;
        })
      }
    );

    vi.doMock("node:module", () => ({
      createRequire: () => requireMock
    }));

    const { createAIActor } = await import("../ai");

    expect(() =>
      createAIActor({
        provider: "anthropic",
        model: "claude-3-5-sonnet-latest",
        apiKey: "test-key"
      })
    ).toThrowError(
      "@loop-engine/sdk requires @anthropic-ai/sdk to use provider 'anthropic'.\nRun: npm install @anthropic-ai/sdk"
    );
  });

  it("switches providers by changing only provider in config", async () => {
    vi.resetModules();

    const createAnthropicActorAdapter = vi.fn(() => ({
      createSubmission: async () => ({ provider: "anthropic" })
    }));
    const createOpenAIActorAdapter = vi.fn(() => ({
      createSubmission: async () => ({ provider: "openai" })
    }));

    const requireMock = Object.assign(
      vi.fn((moduleName: string) => {
        if (moduleName === "@loop-engine/adapter-anthropic") {
          return { createAnthropicActorAdapter };
        }
        if (moduleName === "@loop-engine/adapter-openai") {
          return { createOpenAIActorAdapter };
        }
        throw new Error(`unexpected module load: ${moduleName}`);
      }),
      {
        resolve: vi.fn((moduleName: string) => `/resolved/${moduleName}`)
      }
    );

    vi.doMock("node:module", () => ({
      createRequire: () => requireMock
    }));

    const { createAIActor } = await import("../ai");
    const shared = { model: "test-model", apiKey: "test-key", confidenceThreshold: 0.9 };

    const anthropicActor = createAIActor({ ...shared, provider: "anthropic" });
    const openaiActor = createAIActor({ ...shared, provider: "openai" });

    expect(anthropicActor).toBeDefined();
    expect(openaiActor).toBeDefined();
    expect(createAnthropicActorAdapter).toHaveBeenCalledWith({
      apiKey: "test-key",
      model: "test-model"
    });
    expect(createOpenAIActorAdapter).toHaveBeenCalledWith({
      apiKey: "test-key",
      model: "test-model"
    });
  });
});

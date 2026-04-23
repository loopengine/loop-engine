// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { createRequire } from "node:module";
import type { ActorAdapter } from "@loop-engine/core";

export type AIProvider = "anthropic" | "openai" | "gemini" | "grok";

export interface AIActorConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  confidenceThreshold?: number;
}

/**
 * SDK alias for the `ActorAdapter` contract defined in `@loop-engine/core`.
 * All four `@loop-engine/adapter-{anthropic,openai,gemini,grok}` provider
 * adapters implement `ActorAdapter` (re-homed in SR-013b); this alias is
 * preserved for consumer ergonomics but tightens the shape from the
 * pre-SR-015 loose `{ createSubmission: (...args: unknown[]) => Promise<unknown> }`
 * to the canonical contract.
 */
export type AIActor = ActorAdapter;

type RequireLike = NodeRequire;
type AdapterFactory = (apiKeyOrOptions: string | Record<string, unknown>, config?: Record<string, unknown>) => AIActor;

const PROVIDER_SDK_PACKAGE: Record<AIProvider, string> = {
  anthropic: "@anthropic-ai/sdk",
  openai: "openai",
  gemini: "@google/generative-ai",
  grok: "openai"
};

const ADAPTER_PACKAGE: Record<AIProvider, string> = {
  anthropic: "@loop-engine/adapter-anthropic",
  openai: "@loop-engine/adapter-openai",
  gemini: "@loop-engine/adapter-gemini",
  grok: "@loop-engine/adapter-grok"
};

const ADAPTER_FACTORY_EXPORT: Record<AIProvider, string> = {
  anthropic: "createAnthropicActorAdapter",
  openai: "createOpenAIActorAdapter",
  gemini: "createGeminiActorAdapter",
  grok: "createGrokActorAdapter"
};

function validateConfig(config: AIActorConfig): void {
  if (typeof config.model !== "string" || config.model.trim().length === 0) {
    throw new Error("@loop-engine/sdk createAIActor requires a non-empty model");
  }
  if (typeof config.apiKey !== "string" || config.apiKey.trim().length === 0) {
    throw new Error("@loop-engine/sdk createAIActor requires a non-empty apiKey");
  }
}

function assertProviderSdkInstalled(requireFn: RequireLike, provider: AIProvider): void {
  const sdkPackage = PROVIDER_SDK_PACKAGE[provider];
  try {
    requireFn.resolve(sdkPackage);
  } catch {
    throw new Error(
      `@loop-engine/sdk requires ${sdkPackage} to use provider '${provider}'.\nRun: npm install ${sdkPackage}`
    );
  }
}

function getAdapterFactory(requireFn: RequireLike, provider: AIProvider): AdapterFactory {
  const packageName = ADAPTER_PACKAGE[provider];
  const exportName = ADAPTER_FACTORY_EXPORT[provider];
  let moduleValue: unknown;
  try {
    moduleValue = requireFn(packageName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorWithCode = error as { code?: string };
    if (errorWithCode?.code === "MODULE_NOT_FOUND") {
      throw new Error(
        `@loop-engine/sdk could not load ${packageName} for provider '${provider}'.\nRun: npm install ${packageName}`
      );
    }
    throw new Error(
      `@loop-engine/sdk failed to load ${packageName} for provider '${provider}'. ${message}`
    );
  }

  const moduleRecord =
    moduleValue && typeof moduleValue === "object" ? (moduleValue as Record<string, unknown>) : {};
  const factory = moduleRecord[exportName];
  if (typeof factory !== "function") {
    throw new Error(
      `@loop-engine/sdk expected ${packageName} to export ${exportName} for provider '${provider}'.`
    );
  }
  return factory as AdapterFactory;
}

function getRequire(): RequireLike {
  return createRequire(import.meta.url);
}

export function createAIActor(config: AIActorConfig): AIActor {
  validateConfig(config);
  const requireFn = getRequire();
  assertProviderSdkInstalled(requireFn, config.provider);

  const factory = getAdapterFactory(requireFn, config.provider);
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();

  switch (config.provider) {
    case "anthropic":
    case "openai":
      return factory({
        apiKey,
        model
      });
    case "gemini":
    case "grok":
      return factory(apiKey, {
        modelId: model,
        ...(config.confidenceThreshold !== undefined
          ? { confidenceThreshold: config.confidenceThreshold }
          : {})
      });
    default: {
      const unreachableProvider: never = config.provider;
      throw new Error(`Unsupported provider '${String(unreachableProvider)}'`);
    }
  }
}

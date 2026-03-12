import type { CoreTool, GovernedToolConfig, PendingApprovalResult } from "./types";
import { startGovernedLoop, transitionToState } from "./loop-tool-bridge";

export function wrapTool<TInput, TOutput>(
  tool: CoreTool<TInput, TOutput>,
  config: GovernedToolConfig<TInput>
): CoreTool<TInput, TOutput> {
  return {
    ...tool,
    execute: async (input: TInput): Promise<TOutput> => {
      const loopId = await startGovernedLoop(config.engine, config.loopDefinition, config.actor);

      await transitionToState(
        config.engine,
        config.loopDefinition,
        loopId,
        "AI_ANALYSIS",
        config.actor,
        { tool_input: input as unknown }
      );

      if (config.requiresApproval?.(input)) {
        await transitionToState(
          config.engine,
          config.loopDefinition,
          loopId,
          "PENDING_HUMAN_APPROVAL",
          config.actor,
          { reason: "requiresApproval returned true" }
        );
        if (config.onApprovalRequired) {
          await config.onApprovalRequired(String(loopId), input);
        }
        return {
          status: "pending_approval",
          loopId: String(loopId),
          message: "Awaiting human approval"
        } as unknown as TOutput;
      }

      await transitionToState(config.engine, config.loopDefinition, loopId, "EXECUTING", config.actor);
      const output = await tool.execute(input);
      await transitionToState(
        config.engine,
        config.loopDefinition,
        loopId,
        "EXECUTED",
        config.actor,
        { tool_output: output as unknown }
      );
      return output;
    }
  };
}

export function isPendingApprovalResult(value: unknown): value is PendingApprovalResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.status === "pending_approval" && typeof candidate.loopId === "string";
}

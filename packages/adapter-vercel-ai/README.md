# @loop-engine/adapter-vercel-ai

`@loop-engine/adapter-vercel-ai` wraps Vercel AI SDK tools with Loop Engine governance.

## Why this adapter

Vercel AI SDK tool calls execute as soon as the model selects a tool. This adapter inserts a structural loop so high-impact tool calls can require explicit human approval while preserving a complete transition audit trail.

## Install

```bash
npm install @loop-engine/adapter-vercel-ai ai
```

## Core API

```ts
wrapTool<TInput, TOutput>(
  tool: CoreTool<TInput, TOutput>,
  config: GovernedToolConfig<TInput>
): CoreTool<TInput, TOutput>
```

## Example

```ts
import { tool } from "ai";
import { wrapTool } from "@loop-engine/adapter-vercel-ai";
import { z } from "zod";

const submitPurchaseOrder = wrapTool(
  tool({
    description: "Submit a purchase order to the procurement system",
    parameters: z.object({
      vendor: z.string(),
      amount: z.number(),
      items: z.array(z.string())
    }),
    execute: async ({ vendor, amount, items }) => {
      return { orderId: "PO-0042", status: "submitted", vendor, amount, items };
    }
  }),
  {
    loopDefinition: purchaseOrderLoop,
    engine,
    requiresApproval: ({ amount }) => amount > 5000,
    onApprovalRequired: async (loopId, input) => {
      console.log(`Loop ${loopId} requires approval for $${input.amount} PO`);
    },
    actor: { type: "ai-agent", id: "procurement-agent" as never }
  }
);
```

Drop the wrapped tool into `streamText` or `useChat` without changing the rest of your tool routing.

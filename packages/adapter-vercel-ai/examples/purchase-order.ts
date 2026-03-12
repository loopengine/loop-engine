import { tool } from "ai";
import { z } from "zod";
import type { ActorRef, LoopDefinition } from "@loop-engine/core";
import type { LoopEngine } from "@loop-engine/runtime";
import { wrapTool } from "../src";

declare const purchaseOrderLoop: LoopDefinition;
declare const engine: LoopEngine;

const actor: ActorRef = { type: "ai-agent", id: "procurement-agent" as never };

export const submitPurchaseOrder = wrapTool(
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
    actor
  }
);

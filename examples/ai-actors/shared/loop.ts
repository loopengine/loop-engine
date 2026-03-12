import { LoopBuilder } from "@loop-engine/sdk";

export const replenishmentLoop = LoopBuilder.create("scm.replenishment", "scm")
  .version("1.0.0")
  .description("Triggered replenishment from demand signal")
  .state("SIGNAL_DETECTED")
  .state("AI_ANALYSIS")
  .state("PENDING_BUYER_APPROVAL")
  .state("PO_TRIGGERED", { isTerminal: true })
  .state("DEFERRED", { isTerminal: true })
  .state("ESCALATED", { isTerminal: true })
  .initialState("SIGNAL_DETECTED")
  .transition({
    id: "start_analysis",
    from: "SIGNAL_DETECTED",
    to: "AI_ANALYSIS",
    actors: ["automation", "system"]
  })
  .transition({
    id: "recommend_replenishment",
    from: "AI_ANALYSIS",
    to: "PENDING_BUYER_APPROVAL",
    actors: ["ai-agent", "automation"],
    guards: [
      {
        id: "confidence_threshold",
        severity: "hard",
        evaluatedBy: "external",
        description: "AI confidence must be >= 0.75 to proceed without human review",
        failureMessage: "Confidence below threshold — route to human review"
      }
    ]
  })
  .transition({
    id: "defer",
    from: "AI_ANALYSIS",
    to: "DEFERRED",
    actors: ["ai-agent", "human"]
  })
  .transition({
    id: "escalate",
    from: "AI_ANALYSIS",
    to: "ESCALATED",
    actors: ["ai-agent", "human", "automation"]
  })
  .transition({
    id: "approve_replenishment",
    from: "PENDING_BUYER_APPROVAL",
    to: "PO_TRIGGERED",
    actors: ["human"],
    guards: [
      {
        id: "approval_obtained",
        severity: "hard",
        evaluatedBy: "runtime",
        description: "Buyer must explicitly approve the PO commitment",
        failureMessage: "No approval evidence found"
      }
    ]
  })
  .transition({
    id: "reject_replenishment",
    from: "PENDING_BUYER_APPROVAL",
    to: "DEFERRED",
    actors: ["human"]
  })
  .outcome({
    id: "replenishment_triggered",
    description: "Replenishment PO created and submitted",
    valueUnit: "replenishment_triggered",
    measurable: true,
    businessMetrics: [
      {
        id: "stockout_prevented",
        label: "Stockout prevented",
        unit: "boolean",
        improvableByAI: true
      },
      {
        id: "days_to_reorder",
        label: "Days from signal to PO trigger",
        unit: "days",
        improvableByAI: true
      },
      {
        id: "forecast_accuracy",
        label: "Forecasted vs actual demand variance",
        unit: "percent",
        improvableByAI: true
      }
    ]
  })
  .build();

export const procurementLoop = LoopBuilder.create("scm.procurement", "scm")
  .version("1.0.0")
  .description(
    "Purchase order lifecycle from requisition through receipt and settlement. Tracks approval, supplier confirmation, receipt scheduling, and 3-way match."
  )
  .state("OPEN")
  .state("PO_CONFIRMED")
  .state("RECEIPT_SCHEDULED")
  .state("RECEIVED")
  .state("INVOICE_MATCHED")
  .state("SETTLED", { isTerminal: true })
  .state("CANCELLED", { isTerminal: true, isError: false })
  .state("DISPUTED", { isError: true })
  .initialState("OPEN")
  .transition({
    id: "confirm_po",
    from: "OPEN",
    to: "PO_CONFIRMED",
    actors: ["human", "automation", "ai-agent"],
    guards: [
      {
        id: "approval_obtained",
        severity: "hard",
        evaluatedBy: "external",
        description: "PO must be approved before confirmation",
        failureMessage: "PO confirmation requires explicit approval"
      },
      {
        id: "actor_has_permission",
        severity: "hard",
        evaluatedBy: "runtime",
        description: "Actor must have purchase-order confirm permission",
        failureMessage: "Insufficient permissions to confirm PO"
      }
    ]
  })
  .transition({
    id: "schedule_receipt",
    from: "PO_CONFIRMED",
    to: "RECEIPT_SCHEDULED",
    actors: ["human", "automation"],
    guards: [
      {
        id: "deadline_not_exceeded",
        severity: "soft",
        evaluatedBy: "external",
        description: "Supplier delivery deadline check",
        failureMessage: "Delivery deadline approaching or exceeded"
      }
    ]
  })
  .transition({
    id: "receive_goods",
    from: "RECEIPT_SCHEDULED",
    to: "RECEIVED",
    actors: ["human"]
  })
  .transition({
    id: "match_invoice",
    from: "RECEIVED",
    to: "INVOICE_MATCHED",
    actors: ["human", "automation", "ai-agent"],
    guards: [
      {
        id: "approval_obtained",
        severity: "hard",
        evaluatedBy: "external",
        description: "Three-way match must be confirmed",
        failureMessage: "Invoice match requires 3-way match confirmation"
      }
    ]
  })
  .transition({
    id: "settle",
    from: "INVOICE_MATCHED",
    to: "SETTLED",
    actors: ["automation", "system"]
  })
  .transition({
    id: "cancel",
    from: "OPEN",
    to: "CANCELLED",
    actors: ["human"]
  })
  .transition({
    id: "dispute_from_received",
    from: "RECEIVED",
    to: "DISPUTED",
    actors: ["human"]
  })
  .transition({
    id: "dispute_from_invoice_matched",
    from: "INVOICE_MATCHED",
    to: "DISPUTED",
    actors: ["human"]
  })
  .outcome({
    id: "po_settled",
    description: "Purchase order fully settled with matched invoice and inventory updated",
    valueUnit: "po_settled",
    measurable: true,
    businessMetrics: [
      {
        id: "cycle_time_days",
        label: "PO cycle time (days)",
        unit: "days",
        improvableByAI: true
      },
      {
        id: "three_way_match_first_attempt",
        label: "3-way match on first attempt",
        unit: "boolean",
        improvableByAI: false
      },
      {
        id: "supplier_lead_time_accuracy",
        label: "Supplier lead time accuracy",
        unit: "percentage",
        improvableByAI: true
      }
    ]
  })
  .build();

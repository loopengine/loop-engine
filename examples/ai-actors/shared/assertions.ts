import type { LoopEngine, TransitionResult } from "@loop-engine/runtime";
import type { ReplenishmentContext } from "./types";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

export function logStep(step: string, detail?: string) {
  console.log(`\n${BLUE}->${RESET} ${step}${detail ? `\n  ${DIM}${detail}${RESET}` : ""}`);
}

export function logState(state: string, status: string) {
  console.log(`  ${CYAN}[${state}]${RESET} ${DIM}status: ${status}${RESET}`);
}

export function logResult(result: TransitionResult) {
  if (result.status === "executed") {
    console.log(`  ${GREEN}✓ Executed${RESET} -> ${result.toState}`);
  } else if (result.status === "guard_failed") {
    console.log(`  ${YELLOW}⚠ Guard failed${RESET}`);
    result.guardFailures?.forEach((f) => {
      console.log(`    ${DIM}${f.guardId}: ${f.message}${RESET}`);
    });
  } else if (result.status === "pending_approval") {
    console.log(`  ${YELLOW}⏳ Pending approval${RESET} — requires: ${result.requiresApprovalFrom}`);
  } else {
    console.log(`  ✗ Rejected: ${result.rejectionReason}`);
  }
}

export async function assertLoopReachedState(
  engine: LoopEngine,
  aggregateId: string,
  expectedState: string
) {
  const instance = await engine.getState(aggregateId as never);
  if (!instance) throw new Error(`No loop instance found for ${aggregateId}`);
  if (instance.currentState !== expectedState) {
    throw new Error(`Expected state ${expectedState} but got ${instance.currentState}`);
  }
  console.log(`  ${GREEN}✓ Assert: currentState === '${expectedState}'${RESET}`);
}

export async function assertLoopStatus(
  engine: LoopEngine,
  aggregateId: string,
  expectedStatus: string
) {
  const instance = await engine.getState(aggregateId as never);
  if (!instance) throw new Error(`No loop instance found for ${aggregateId}`);
  if (instance.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus} but got ${instance.status}`);
  }
  console.log(`  ${GREEN}✓ Assert: status === '${expectedStatus}'${RESET}`);
}

export async function printLoopSummary(
  engine: LoopEngine,
  aggregateId: string,
  ctx: ReplenishmentContext
) {
  const instance = await engine.getState(aggregateId as never);
  const history = await engine.getHistory(aggregateId as never);
  if (!instance || !history) return;

  console.log(`\n${"─".repeat(60)}`);
  console.log("Loop Summary");
  console.log("─".repeat(60));
  console.log(`  SKU:          ${ctx.signal.sku} — ${ctx.signal.skuName}`);
  console.log(`  Location:     ${ctx.signal.location}`);
  console.log(`  Spike:        +${ctx.signal.spikePercent}% vs baseline`);
  console.log(`  Final state:  ${instance.currentState}`);
  console.log(`  Status:       ${instance.status}`);
  console.log(`  Transitions:  ${history.length}`);

  const aiTransition = history.find((t) => t.actor.type === "ai-agent");
  if (aiTransition) {
    console.log(`  AI actor:     ${aiTransition.actor.agentId ?? aiTransition.actor.id}`);
    console.log(`  AI confidence: ${aiTransition.evidence?.ai_confidence}`);
    console.log(`  AI reasoning: ${aiTransition.evidence?.ai_reasoning}`);
  }

  const humanTransition = history.find((t) => t.actor.type === "human");
  if (humanTransition) {
    console.log(`  Human actor:  ${humanTransition.actor.id}`);
    console.log(`  Approval:     ${humanTransition.evidence?.approval_comment ?? "no comment"}`);
  }

  console.log("─".repeat(60));
}

# Getting Started

## What is Loop Engine?

Enterprise AI and automation need a control layer around operational decisions. Without explicit
state, actor attribution, and policy checks, it is hard to explain what happened or enforce
business constraints.

Loop Engine provides finite-state control for operational processes, explicit actors on every
transition, guard policies (hard/soft), event emission, and signal/metrics building blocks for
continuous improvement.

Loop Engine is not a workflow engine, a BPM tool, or an AI framework. It is a control layer.

## Installation

```bash
npm install @loop-engine/sdk
```

Node.js 18+ is required.

## Your first loop

```ts
import { aggregateId, transitionId } from "@loop-engine/core";
import { LoopBuilder, createLoopSystem } from "@loop-engine/sdk";

async function main() {
  // 1) Define a loop with LoopBuilder
  const expenseApproval = LoopBuilder.create("finance.expense_approval", "finance")
    .version("1.0.0")
    .description("Expense approval from submit to approval")
    .state("OPEN")
    .state("AUTO_REVIEWED")
    .state("APPROVED", { isTerminal: true })
    .initialState("OPEN")
    .transition({
      id: "auto_review",
      from: "OPEN",
      to: "AUTO_REVIEWED",
      actors: ["automation"]
    })
    .transition({
      id: "approve",
      from: "AUTO_REVIEWED",
      to: "APPROVED",
      actors: ["human"]
    })
    .outcome({
      id: "expense_approved",
      description: "Expense approved and closed",
      valueUnit: "expense_approved",
      measurable: true
    })
    .build();

  // 2) Start the loop
  const aggregate = aggregateId("expense-001");
  const { engine, eventBus } = createLoopSystem({ loops: [expenseApproval] });

  eventBus.subscribe(async (event) => {
    console.log(event.type);
  });

  await engine.start({
    loopId: "finance.expense_approval",
    aggregateId: aggregate,
    orgId: "acme",
    actor: { type: "automation", id: "expense-intake-service" }
  });

  // 3) Transition through it (2 transitions)
  await engine.transition({
    aggregateId: aggregate,
    transitionId: transitionId("auto_review"),
    actor: { type: "automation", id: "policy-engine" },
    evidence: { ruleset: "expense-v1" }
  });

  await engine.transition({
    aggregateId: aggregate,
    transitionId: transitionId("approve"),
    actor: { type: "human", id: "manager-42" },
    evidence: { approved: true }
  });

  // 4) Read final state
  const finalState = await engine.getState(aggregate);
  console.log(finalState);
}

void main();
```

## What just happened

- The loop moved across 3 states: `OPEN -> AUTO_REVIEWED -> APPROVED`.
- Two actor types executed transitions: `automation` and `human`.
- Each successful transition emitted a `loop.transition.executed` event.
- The final state is terminal (`APPROVED`), so loop status is `CLOSED`.

## Next steps

- [Architecture](./architecture.md)
- [Boundary](./boundary.md)
- [SCM procurement loop example](../loops/scm/procurement.yaml)

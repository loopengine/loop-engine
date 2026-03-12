# How to Design a Loop

Loop Engine is flexible, but there is still a "right way" to model loops.
This guide is opinionated on purpose and grounded in the reference loops under `loops/`.

## A loop is not a workflow

Workflows track task completion ("step A, then B, then done").
Loops track operational outcomes ("what changed in the world and can we measure it").

Example:

- Task: "send invoice email"
- Loop outcome: "invoice_collected"

A task can happen inside a loop, but the loop should be centered on the measurable outcome.

## Design from the outcome backward

Start with `outcome.id` and `outcome.valueUnit`.

If you cannot name the measurable outcome, stop and refine before adding states.

```yaml
# Bad
outcome:
  id: process_completed
  valueUnit: completed

# Better
outcome:
  id: invoice_collected
  valueUnit: invoice_collected
```

The canonical loops (`finance.invoice_collection`, `scm.procurement`, `crm.lead_qualification`)
all define concrete outcomes with business meaning.

## States are nouns, transitions are verbs

States describe current world state. Transitions describe the action that moved it.

From `loops/scm/procurement.yaml`:

- States: `OPEN`, `PO_CONFIRMED`, `RECEIVED`, `INVOICE_MATCHED`, `SETTLED`
- Transitions: `confirm_po`, `receive_goods`, `match_invoice`, `settle`

Pattern to keep: state names read like status labels in audit timelines; transition names read
like actions.

## Every terminal state needs a business name

Avoid generic terminal names when a domain-specific name exists.

- Weak: `COMPLETED`
- Better: `SETTLED`, `QUALIFIED`, `COLLECTED`

Terminal state names appear in events, observability, and downstream dashboards.

## Hard guards for policy, soft guards for warnings

Use `severity: hard` for non-negotiable policy. Use `severity: soft` for warnings.

Examples already in repo:

- Hard policy: `approval_obtained` on procurement `confirm_po` / `match_invoice`
- Soft warning: `deadline_not_exceeded` on scheduling/escalation transitions

Practical rule:

- "Must never happen" -> hard guard
- "Should be reviewed" -> soft guard

## AI actors should not be sole actor on a transition

In the canonical loops, AI is present but not exclusive.
`loops/scm/replenishment.yaml` keeps `human` or `automation` available alongside `ai-agent`.

Quick check:

```bash
rg -n "allowedActors:\\s*\\[ai-agent\\]" loops
```

If this matches, review the transition design before merging.

## Business metrics make loops improvable

When `outcome.businessMetrics` exists, you can turn loop completion into measurable learning.

`extractLearningSignal(...)` computes:

- `predicted` (what was expected)
- `actual` (what happened)
- `delta` (numeric difference)

Without metrics, loops execute but improve slowly because there is less feedback signal.

## When to spawn a child loop

Use `spawnableLoops` when parent completion consistently triggers a new loop.

In canonical YAML:

- `scm.replenishment` lists `spawnableLoops: [scm.procurement]`
- `scm.procurement` lists `spawnableLoops: [scm.replenishment]`

Do not spawn child loops for optional side paths; model those as transitions/signals instead.

## Common mistakes

1. Too many states: if you exceed ~8 states, consider splitting into two loops.
2. Missing failure path: if failures are meaningful, model explicit error/terminal states.
3. Guard sprawl: repeated guards on many exits usually means states are too broad.
4. Anonymous automation: use stable actor IDs (`service-name`, not `unknown`).
5. Vague outcome units: `valueUnit` should be domain-measurable, not generic.

# loop-engine-governance

Add governed decision loops to OpenClaw workflows with human approval gates, AI confidence guards, and auditable transition history.

## Registry metadata

- **Name:** `loop-engine-governance`
- **Maintainer:** Better Data OSS Team (`oss@betterdata.co`)
- **Homepage:** https://loopengine.io/docs/integrations/openclaw
- **Source:** https://github.com/loopengine/loop-engine/tree/main/packages/adapter-openclaw/loop-engine-governance
- **Package org:** https://www.npmjs.com/org/loop-engine

## What this skill does

This skill wires [Loop Engine](https://loopengine.io) into OpenClaw so that workflow actions are governed by runtime policy:

- **Human approval gates** for sensitive transitions
- **AI confidence thresholds** for model-driven actions
- **Evidence requirements** before execution
- **Immutable audit records** for attribution and review

## Install spec

Install base dependencies:

```bash
npm install @loop-engine/sdk @loop-engine/adapter-openclaw @loop-engine/adapter-memory
```

Install AI provider adapters as needed:

```bash
# Anthropic / Claude examples
npm install @loop-engine/adapter-anthropic @anthropic-ai/sdk

# OpenAI examples
npm install @loop-engine/adapter-openai openai

# Grok (xAI) examples
npm install @loop-engine/adapter-grok openai

# Gemini examples
npm install @loop-engine/adapter-gemini @google/generative-ai
```

Maintainer verification: Better Data maintains `@loop-engine/*` packages published under the Loop Engine npm org and source-controlled in the Loop Engine GitHub repository listed above.

## Environment variables

Declare provider keys before running examples that call external LLM APIs:

| Example | Required env vars |
|---|---|
| `example-expense-approval.ts` | none (human-only governance flow) |
| `example-ai-replenishment-claude.ts` | `ANTHROPIC_API_KEY` |
| `example-infrastructure-change-openai.ts` | `OPENAI_API_KEY` |
| `example-fraud-review-grok.ts` | `XAI_API_KEY` |
| Gemini-based examples | `GOOGLE_AI_API_KEY` |

## Data handling and privacy disclosure

This skill may send prompt context and evidence payloads to external model providers when AI adapter examples are used (Anthropic, OpenAI, xAI, or Google). Do not include secrets, regulated data, or customer PII unless your legal/compliance review explicitly permits transmission to that provider.

- **Sent externally (AI examples):** prompt text, selected evidence fields, model parameters, and model responses.
- **Processed locally (runtime governance):** guard evaluation, actor authorization checks, transition persistence, and audit trail generation.

Review each provider's data handling policy before production use.

## Synthetic data disclosure

Example files in this skill are written for demonstration and use fictional or synthetic data patterns. They are not intended to include real customer records or production PII.

## Quick start

```typescript
import { CommonGuards, createLoopSystem, parseLoopYaml } from "@loop-engine/sdk";
import { MemoryAdapter } from "@loop-engine/adapter-memory";

const definition = parseLoopYaml(`
  loopId: approval.workflow
  name: Approval Workflow
  version: 1.0.0
  initialState: pending
  states:
    - stateId: pending
      label: Pending Approval
    - stateId: approved
      label: Approved
      terminal: true
    - stateId: rejected
      label: Rejected
      terminal: true
  transitions:
    - transitionId: approve
      from: pending
      to: approved
      signal: approve
      allowedActors: [human]
      guards: [human-only]
`);

const system = createLoopSystem({
  storage: new MemoryAdapter(),
  guards: CommonGuards
});

const loop = await system.startLoop({ definition, context: {} });

await system.transition({
  loopId: loop.loopId,
  signalId: "approve",
  actor: { id: "alice", type: "human" },
  evidence: { reviewNote: "Looks good" }
});
```

## License

`loop-engine-governance` documentation/examples are MIT-0. Loop Engine packages are Apache-2.0.

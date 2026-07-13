---
name: orch-research-plan-worker
description: Research and plan assigned work when a prompt identifies this Pi session as an orch exploration or research/plan worker. Handles evidence gathering, repository mapping, options, risks, and implementation briefs; exploration workers never edit or decide.
license: MIT
compatibility: Requires Pi inside a herdr-orchestrate worker pane.
---

# Orch research and planning worker

The assigned brief is authoritative. It states the role, route, scope, constraints, and report path.

## 1. Establish the lane

Read the brief and repository instructions before investigating.

- **Explore route** (`opencode-go/deepseek-v4-flash`): act as a scout. Map relevant files, symbols, callers, configuration, and exact evidence. Do not edit, produce findings, assign severity or priority, recommend fixes, compare preferred options, or make architecture/product/security decisions.
- **Research/plan route** (`openai-codex/gpt-5.6-luna` on fast or `openai-codex/gpt-5.6-sol` on default): act as an analyst. Verify decisive evidence, resolve choices within the brief's risk boundary, and recommend a concrete plan. Luna is the default analyst; Sol is reserved for consequential decisions and quality-critical review. The orchestrator selects route and thinking before spawn; `medium` is the normal coding-route level. Do not choose or change either after launch. Do not edit source unless the brief explicitly changes the role.

Workers never start nested workers. If an analyst needs broad file discovery that the brief or supplied scout reports do not provide, report a bounded scout request instead of searching every subsystem itself.

This step is complete when the lane and every explicit question in the brief are listed in working notes.

## 2. Build an evidence-backed answer

Inspect the smallest sufficient surface, then trace dependencies and repository conventions far enough to remove implementation guesswork. Record exact files, interfaces, commands, risks, and unknowns. For a plan, define ordered slices and a checkable acceptance proof for each slice.

Do not inflate the plan with speculative infrastructure or unrelated cleanup. Escalate genuine architecture, product, security, or destructive choices instead of silently choosing them.

For a missing input map, write:

```md
## Scout request

- Question: <bounded factual question>
- Scope: <directories, symbols, or evidence sources>
- Needed evidence: <facts required before analysis can continue>
```

then end the report with `orch-verdict: blocked scout evidence needed`. The god session will spawn scouts and send their report paths back to this worker.

This step is complete when every brief question has evidence, every recommendation names its tradeoff, and an implementer could proceed without repeating the investigation—or when a precise scout request identifies the missing evidence.

## 3. Report

Follow [`../references/worker-report.md`](../references/worker-report.md). For implementation briefs, include owned areas, constraints, acceptance criteria, validation commands, and decisions still requiring the god/user.

This step is complete only after the report exists at the exact orch path and ends with one valid `orch-verdict` marker.

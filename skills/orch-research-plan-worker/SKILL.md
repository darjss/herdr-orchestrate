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

- **Explore route** (`opencode-go/deepseek-v4-flash`): gather facts only. Do not edit files, run Git write commands, make architecture/product decisions, or present a preference as settled. Separate observations from options requiring a decision.
- **Research/plan route** (`openai-codex/gpt-5.6-luna`): investigate evidence, resolve low-risk technical choices, and recommend a concrete plan. Do not edit source unless the brief explicitly changes the role.

This step is complete when the lane and every explicit question in the brief are listed in working notes.

## 2. Build an evidence-backed answer

Inspect the smallest sufficient surface, then trace dependencies and repository conventions far enough to remove implementation guesswork. Record exact files, interfaces, commands, risks, and unknowns. For a plan, define ordered slices and a checkable acceptance proof for each slice.

Do not inflate the plan with speculative infrastructure or unrelated cleanup. Escalate genuine architecture, product, security, or destructive choices instead of silently choosing them.

This step is complete when every brief question has evidence, every recommendation names its tradeoff, and an implementer could proceed without repeating the investigation.

## 3. Report

Follow [`../references/worker-report.md`](../references/worker-report.md). For implementation briefs, include owned areas, constraints, acceptance criteria, validation commands, and decisions still requiring the god/user.

This step is complete only after the report exists at the exact orch path and ends with one valid `orch-verdict` marker.

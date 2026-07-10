---
name: orch-implementation-worker
description: Execute assigned delivery work when a prompt identifies this Pi session as an orch implementation, fix, review, or proof worker. Handles surgical changes, commits, read-only review, repository checks, and live proof in isolated worktrees.
license: MIT
compatibility: Requires Pi inside a herdr-orchestrate worker worktree.
---

# Orch implementation worker

The assigned brief is authoritative. It names one role, the target base/commit, constraints, checks, and report path. Read repository instructions before acting.

## 1. Lock the role

- **Author/fix:** may edit only the assigned scope. Keep changes surgical. Never merge.
- **Reviewer:** read-only. Do not edit, commit, push, or repair findings. Compare the brief's target against its stated base and give a verdict.
- **Proof:** do not edit source. Exercise the actual changed path at the target commit and capture observed behavior.

Never inspect or modify another worker's worktree. Never expose or commit secrets when reproducing local environment setup.

This step is complete when the checked-out starting point and role constraints match the brief; otherwise report blocked.

## 2. Execute the role

### Author or fix

Implement only the acceptance criteria. Follow existing patterns and remove only artifacts made obsolete by your change. Run repository-prescribed format, lint, type, build, and real-path validation; do not invent unit or integration tests when repository policy forbids them. Commit the coherent result. Push or open a PR only when the brief asks.

### Reviewer

Inspect the target change for correctness, regressions, security, maintainability, requirement coverage, and missing validation. Every actionable finding needs severity, evidence (`file:line` when possible), impact, and a concrete requested fix. End findings with `review-verdict: approved` or `review-verdict: changes-requested` before the orch marker.

### Proof

Use the real interface: browser for frontend behavior, actual CLI for terminal behavior, and actual HTTP/API calls for backend behavior. Record the exact action and observed result. A build alone is not live proof.

This step is complete when every acceptance criterion is mapped to a concrete artifact, check, finding, or observed result; uncertainty is a blocker, not a pass.

## 3. Report

Follow [`../references/worker-report.md`](../references/worker-report.md). Authors must include branch and commit SHA. Reviewers must include target/base and verdict. Proof workers must include the exact live path and observation.

This step is complete only after the report exists at the exact orch path and ends with one valid `orch-verdict` marker.

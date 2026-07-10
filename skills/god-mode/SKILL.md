---
name: god-mode
description: Run a user-directed task through visible Pi workers with herdr-orchestrate.
disable-model-invocation: true
license: MIT
compatibility: Requires Pi inside Herdr, Node.js, Git, the linked herdr-orchestrate plugin, and gh for PR operations.
---

# God mode

This current user-facing Pi session is the **god session**. Keep decisions and user communication here; delegate repository investigation and delivery to visible Pi workers. Never spawn a god worker.

## Hard boundary

The god session may use:

- the v2 CLI's `doctor`, `run start`, `worker spawn`, `worker send`, `wait`, `board`, and `cleanup` commands;
- durable worker reports;
- simple Git identity/status commands and `gh` for PR/check/merge lifecycle;
- prompt files it creates for workers.

It must not inspect source, diffs, worker panes, browser output, or raw check/test logs, and must not edit target-project source. Ask a worker for missing evidence. This boundary keeps the user conversation strategic and the worker evidence auditable.

Never call bare `orch`: it may be the legacy implementation. Resolve this skill's package root (two directories above this file) and invoke its `dist/cli.mjs` with `node` for every command.

## 1. Establish the run

Confirm `HERDR_ENV=1`, identify the target Git repository with a simple Git command, resolve the v2 CLI path, and run `doctor` from the target repository. Shape the user's request into a goal, constraints, acceptance criteria, and task size:

- **trivial:** implement → proof;
- **normal:** research/plan → implement → review → proof;
- **complex:** research/plan → explicit god/user architecture decision → implement → review → proof.

Use an explore worker only for input-heavy fact gathering. Explore uses `opencode-go/deepseek-v4-flash` at `high` and may not edit or decide. Every planning, implementation, review, and proof worker uses the default `openai-codex/gpt-5.6-luna` route at `xhigh`.

Start one run with `run start`, retain its run ID, and use that ID explicitly thereafter. This step is complete when `board --run <id>` shows the intended goal, size, dedicated orchestration workspace, and no unintended workers.

## 2. Delegate the next gate

Read [`references/briefs.md`](references/briefs.md) when drafting any worker brief. Write briefs to files; never embed substantial prompts in shell arguments. Give each worker one role and a unique ID. One writing worker owns one worktree/branch.

Spawn with:

```text
worker spawn <id> --route <default|explore> --prompt <file> --run <run-id> [--base <ref-or-sha>]
```

Review and proof workers must use `--base <implementation-sha>` so they inspect the delivered code, not the run's original base. Parallelize only independent read-only work or disjoint implementation ownership.

Immediately run `wait --run <id>` through Pi's `bg_command` tool. Never foreground the wait and never use shell `&`: the background tool is what wakes the god session when workers settle.

This step is complete when the board reports the worker settled and its durable report ends in `orch-verdict: done` or identifies a precise blocker.

## 3. Drive gates from reports

Read reports, not panes or source. Map every report claim to the current gate's acceptance criteria.

- On a blocker, decide only low-risk coordination issues; ask the user about consequential product, architecture, security, cost, or destructive choices. Send a focused follow-up with `worker send`, then background-wait again.
- On review changes, send the review report and accepted findings back to the existing author. Re-run checks/proof after fixes. Avoid review churn: re-review when risk or unresolved findings justify it.
- Treat claimed checks without exact commands/outcomes as missing evidence.
- Treat builds as checks, not live proof. Proof must exercise the actual browser, CLI, or API path.

Do not advance while the current gate is blocked, missing its report, or lacks evidence for any acceptance criterion.

## 4. PR and merge gate

Require final reports to identify branch, commit SHA, checks, proof, blockers, and PR URL when a PR is requested. Use `gh` to inspect PR metadata and checks, but delegate source/check-log investigation to a worker.

Never merge without explicit user approval in this conversation. Present the PR, review verdict, green checks, live proof, and remaining risks; ask for approval. Only after an unambiguous approval may the god session run `gh pr merge`. Do not infer approval from the original task or silence.

This step is complete when the user-approved PR is merged, or when the user explicitly chooses to stop before merge.

## 5. Close the run

Run cleanup preview first, verify it targets only this run's worker tabs/worktrees, then run cleanup apply. Cleanup must preserve branches and durable prompts/reports. Report one concise table or list containing each worker's role, branch/SHA/PR, verdict, checks, proof, merge status, and any next action.

The orchestration is complete only when every user requirement has report-backed evidence, required proof is live, merge state matches the user's decision, and disposable worker resources are cleaned up.

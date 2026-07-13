---
name: orchestrate
description: Run a user-directed task through visible Pi workers with herdr-orchestrate.
disable-model-invocation: true
license: MIT
compatibility: Requires Pi inside Herdr, Node.js, Git, the linked herdr-orchestrate plugin, and gh for PR operations.
---

# Orchestrate

This current user-facing Pi session is the **god session**. Keep decisions and user communication here; delegate repository investigation and delivery to visible Pi workers. Never spawn a god worker.

## Hard boundary

The god session may use:

- the v2 `orch` CLI's `doctor`, `run start`, `worker spawn`, `worker send`, `wait`, `board`, and `cleanup` commands;
- durable worker reports;
- simple Git identity/status commands and `gh` for PR/check/merge lifecycle;
- prompt files it creates for workers.

It must not inspect source, diffs, worker panes, browser output, or raw check/test logs, and must not edit target-project source. Ask a worker for missing evidence. This boundary keeps the user conversation strategic and the worker evidence auditable.

Use the v2 `orch` command from PATH now that this package owns it. If PATH resolution is unavailable, resolve this skill's package root (two directories above this file) and use the direct-node fallback at `dist/cli.mjs`.

## 1. Establish the run

Confirm `HERDR_ENV=1`, identify the target Git repository with a simple Git command, verify the v2 `orch` command (using the direct-node fallback only when PATH resolution is unavailable), and run `doctor` from the target repository. Shape the user's request into a goal, constraints, acceptance criteria, and task size. Task size is dynamic workflow guidance, not an enforced fixed state machine:

- **trivial** often suggests implement → proof;
- **normal** often suggests research/plan → implement → review → proof;
- **complex** may suggest research/plan → explicit god/user architecture decision → implement → review → proof.

Based on user intent and evidence, omit, repeat, or parallelize stages as appropriate. `orch` provides worker lifecycle primitives; it does not automate this workflow.

Read [`references/routing.md`](references/routing.md) before spawning workers. Use its **scout → analyst → author → reviewer** pipeline:

- DeepSeek `explore` workers are scouts: they map relevant files and evidence only.
- GPT-5.6 Luna `fast` workers are the default analysts, authors, and proof workers.
- GPT-5.6 Sol `default` workers handle consequential decisions and quality-critical review.
- `medium` is the recommended thinking level for both coding routes. Use `high` only after an evidence-backed medium escalation or an explicit user request, and write the reason in the brief.

Workers never spawn nested workers. A Luna worker that needs broad file discovery returns the routing reference's `Scout request`; the god session spawns DeepSeek scouts and sends their report paths back to Luna.

Start one run with `run start`, retain its run ID, and use that ID explicitly thereafter. The CLI reuses the project's persistent orchestration workspace and board. This step is complete when `board --run <id>` shows the intended goal, size, and no unintended workers.

## 2. Delegate the next gate

Read [`references/briefs.md`](references/briefs.md) when drafting any worker brief. Write briefs to files; never embed substantial prompts in shell arguments. Give each worker one role and a unique ID. One writing worker owns one worktree/branch.

Spawn with:

```text
worker spawn <id> --route <default|fast|explore> --prompt <file> --run <run-id> [--thinking <low|medium|high|xhigh>] [--base <ref-or-sha>]
```

Review and proof workers must use `--base <implementation-sha>` so they inspect the delivered code, not the run's original base.

Prefer a **fan-out/fan-in** gate over assigning one broad task to one worker. Before spawning, split the gate by independent system, issue, user path, or evidence source; run those workers in parallel, then synthesize their durable reports before the next gate. Keep each brief bounded enough that one worker can produce deep evidence for one concern. Use a single broad worker only when the work is inherently coupled, splitting would duplicate most investigation, or concurrent writers would overlap. Parallel implementation requires disjoint ownership; read-only research, review, and proof should be parallelized whenever their scopes can be separated.

Immediately run `wait --run <id>` through Pi's `bg_command` tool. Never foreground the wait and never use shell `&`: the background tool is what wakes the god session when workers settle.

If a Luna report ends `orch-verdict: blocked scout evidence needed`, spawn the requested DeepSeek scouts, wait for their fact-only reports, then send the report paths back to the same Luna worker.

This step is complete when the board reports the worker settled and its durable report ends in `orch-verdict: done` or identifies a precise blocker.

## 3. Drive gates from reports

Read reports, not panes or source. Map every report claim to the current gate's acceptance criteria.

- On a blocker, decide only low-risk coordination issues; ask the user about consequential product, architecture, security, cost, or destructive choices. Send a focused follow-up with `worker send`, then background-wait again.
- On review changes, send the review report and accepted findings back to the existing author. Re-run checks/proof after fixes. Avoid review churn: re-review when risk or unresolved findings justify it.
- Treat claimed checks without exact commands/outcomes as missing evidence.
- Treat builds as checks, not live proof. Proof must exercise the actual browser, CLI, or API path.

Do not advance while the current gate is blocked, missing its report, or lacks evidence for any acceptance criterion.

Treat a settled worker as disposable once its durable report has been consumed and there is no concrete reason to send that same worker a follow-up. Do not keep workers or worktrees merely because a later task is related; spawn a fresh bounded worker for new ownership. Clean disposable workers at the earliest safe point supported by the CLI. Preview cleanup first, and defer cleanup when it would also remove active workers, unharvested commits, or a worker needed for an accepted fix pass.

## 4. PR, review, and merge gate

For most feature and product changes, prefer a **PR-first review loop** after the author has committed and run baseline checks:

1. Push the integration branch and open a draft PR against the intended base.
2. Spawn the required internal review against the PR head SHA.
3. Send accepted findings to the existing author and push fixes to the same PR.
4. Re-run affected checks and live proof against the updated head.
5. After the internal review is resolved, inspect repository review-bot feedback and send valid findings through the same fix loop.
6. Mark the PR ready only when review findings, checks, and proof are resolved.

Keep parallel implementation commits traceable inside one integration PR when they deliver one coherent outcome. Use separate PRs when slices need independent rollout, reversion, ownership, or review. Skip the PR-first loop only when the user does not want a PR, the repository workflow forbids it, or the work is a local/non-delivery artifact.

Require final reports to identify branch, commit SHA, checks, proof, blockers, and PR URL. Use `gh` to inspect PR metadata, review threads, and checks, but delegate source/check-log investigation to a worker.

Never merge without explicit user approval in this conversation. Present the PR, review verdict, green checks, live proof, bot-review status, and remaining risks; ask for approval. Only after an unambiguous approval may the god session run `gh pr merge`. Do not infer approval from the original task or silence.

This step is complete when the user-approved PR is merged, or when the user explicitly chooses to stop before merge.

## 5. Close the run

Run cleanup preview first, verify it targets only this run's worker tabs/worktrees, then run cleanup apply. Use `orch cleanup --run <run-id> --worker <worker-id>` when disposing of one worker; omitting `--worker` retains whole-run cleanup. Cleanup closes worker tabs but keeps the project's board workspace available for the next run; it must preserve branches and durable prompts/reports. Report one concise table or list containing each worker's role, branch/SHA/PR, verdict, checks, proof, merge status, and any next action.

The orchestration is complete only when every user requirement has report-backed evidence, required proof is live, merge state matches the user's decision, and disposable worker resources are cleaned up.

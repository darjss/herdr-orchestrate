# Implementation Plan

## 1. Foundation

- Define versioned, per-project/run JSON state outside target repositories.
- Create the `orch` v2 CLI and a small core domain module.
- Add `doctor` validation for Git, Herdr, Pi, and supported model routes.
- Create or reuse one persistent `<project>-orchestrate` Herdr workspace per project; never place workers in the orchestrator's workspace.

## 2. Pi Worker Launcher

- Launch isolated Git worktrees and visible Herdr panes.
- Route every worker explicitly through Pi:
  - Sol low/medium/high/xhigh: default planning, implementation, review, and proof route; choose before spawn by task risk, with xhigh only for explicit escalation.
  - OpenCode Go DeepSeek V4 Flash at high: input-heavy exploration only; no edits or decisions.
- Persist the selected provider, model, and thinking level with each worker.

## 3. Run Lifecycle

- Support arbitrary workers and dependency-free stage transitions.
- Use task size as dynamic workflow guidance rather than an enforced state machine: trivial tasks often need implementation and proof, normal tasks often benefit from research/plan → implement → review → proof, and complex tasks may need a user/god architecture decision before implementation. The god session may omit, repeat, or parallelize stages based on intent and evidence; `orch` does not automate workflow stages.
- Store prompts, reports, logs, worktrees, branches, PRs, verdicts, checks, and proof as durable artifacts.

## 4. Herdr Plugin

- Ship `herdr-plugin.toml` with doctor, status, reconcile, and cleanup-preview actions.
- Open the read-only auto-refreshing board as the first pane in each persistent orchestration workspace and reuse it across runs.
- Build a run wizard. Defer a worker wizard: two explicit CLI routes are sufficient for v1.
- Add `orch wait` for Pi background-command wakeups; the god skill will require it to run through Pi's background tool.

## 5. GitHub Gates

- Let workers commit, push, and open PRs.
- Record review/proof evidence before a PR is ready.
- Require explicit recorded user approval before the god agent can merge.

## 6. Dogfood and Release

- Use herdr-orchestrate to implement itself.
- Validate worker recovery, model routing, prompt delivery, board state, workspace isolation, background wait, PR creation, and merge approval.
- Commit built plugin artifacts, tag a release, and document `herdr plugin install darjss/herdr-orchestrate`.

## 7. Orchestrate Skill (last)

- Write the user-invoked `orchestrate` skill only after the CLI and plugin contract are stable.
- Encode Pi background waiting, the two worker routes, model selection, user-intent shaping, and the no-direct-inspection policy.

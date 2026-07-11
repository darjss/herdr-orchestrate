# herdr-orchestrate

Pi-native orchestration for visible [Herdr](https://herdr.dev) worker sessions.

`herdr-orchestrate` provides a Herdr run board, durable prompts/reports/state, isolated Git worktrees, explicit Pi model routing, background waiting, and safe cleanup. The user-facing `orchestrate` skill keeps the current Pi session strategic while delegated workers remain visible and auditable in a persistent project workspace.

## Model routes

| Route     | Provider/model                  | Thinking | Contract                                            |
| --------- | ------------------------------- | -------- | --------------------------------------------------- |
| `default` | `openai-codex/gpt-5.6-sol`      | `medium` | Planning, implementation, review, and proof         |
| `explore` | `opencode-go/deepseek-v4-flash` | `high`   | Input-heavy exploration only; no edits or decisions |

The current user-facing Pi session is the god agent. The CLI never spawns a god worker.

Default-route workers accept an optional `--thinking low|medium|high|xhigh` override. The selected level is persisted with the worker and passed to Pi; explore workers remain at high and reject non-high overrides.

## Install from GitHub

Review the repository before installing: Pi packages and Herdr plugins can execute commands with your user permissions.

```bash
pi install https://github.com/darjss/herdr-orchestrate
herdr plugin install darjss/herdr-orchestrate
```

For local development:

```bash
vp install
vp run build
herdr plugin link .
pi install /absolute/path/to/herdr-orchestrate
```

Restart Pi after installing so it discovers the packaged skills. Invoke the user-only orchestrator with:

```text
/skill:orchestrate
```

The skill uses the v2 `orch` command from PATH. If PATH resolution is unavailable, use the direct-node fallback shown below.

## CLI

Use the v2 CLI from PATH:

```bash
orch doctor
orch run start "describe the task" --size normal
orch worker spawn research \
  --route default --thinking medium --prompt brief.md --run <run-id>
orch worker spawn review \
  --route default --prompt review.md --run <run-id> --base <implementation-sha>
orch worker send research \
  --text "focused follow-up" --run <run-id>
orch board --run <run-id>
orch wait --run <run-id>
orch cleanup --run <run-id>
orch cleanup --run <run-id> --apply
```

For local development or when `orch` is not on PATH, use the direct-node fallback:

```bash
node /path/to/herdr-orchestrate/dist/cli.mjs doctor
```

Run `wait` through Pi's background-command tool. That lets Pi end its current turn and wake when workers settle.

## Workflow guidance

Task size provides dynamic workflow guidance, not an enforced fixed state machine. Trivial tasks often need implementation and proof, normal tasks often benefit from research, implementation, review, and proof, and complex tasks may need an explicit architecture decision first. The god session may omit, repeat, or parallelize stages based on user intent and evidence; `orch` does not automate those stages.

Before each default-route spawn, choose thinking from task risk: `low` for trivial bounded low-risk tasks, `medium` for routine work, `high` for difficult debugging, security, or architecture work, and `xhigh` only for explicit escalation. Workers do not choose their level after launch.

Durable state defaults to `~/dev/orch-v2`; override it with `ORCH_STATE_DIR`.

## Safety gates

- Each project reuses one persistent `<project>-orchestrate` workspace.
- The board occupies the first root pane; each worker gets one tab with one root pane.
- Workers use isolated worktrees and durable per-pass report paths.
- Cleanup previews before applying, closes only worker tabs, and preserves the board workspace, branches, and reports.
- PR operations use `gh`; merging always requires explicit user approval.

## Development

```bash
vp install
vp check
vp pack
vp run build
```

Validation is performed with live Herdr/Pi/CLI smoke runs rather than unit or integration tests.

## License

MIT

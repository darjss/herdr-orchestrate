# herdr-orchestrate

Pi-native orchestration for visible [Herdr](https://herdr.dev) worker sessions.

`herdr-orchestrate` provides a Herdr run board, durable prompts/reports/state, isolated Git worktrees, explicit Pi model routing, background waiting, and safe cleanup. The user-facing `god-mode` skill keeps the current Pi session strategic while delegated workers remain visible and auditable in a dedicated Herdr workspace.

## Model routes

| Route     | Provider/model                  | Thinking | Contract                                            |
| --------- | ------------------------------- | -------- | --------------------------------------------------- |
| `default` | `openai-codex/gpt-5.6-luna`     | `xhigh`  | Planning, implementation, review, and proof         |
| `explore` | `opencode-go/deepseek-v4-flash` | `high`   | Input-heavy exploration only; no edits or decisions |

The current user-facing Pi session is the god agent. The CLI never spawns a god worker.

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
/skill:god-mode
```

The skill resolves `dist/cli.mjs` from its package and intentionally does not call a bare `orch`; an older implementation may already occupy that PATH name.

## CLI

Until v2 intentionally replaces any legacy PATH command, invoke the built CLI directly:

```bash
node /path/to/herdr-orchestrate/dist/cli.mjs doctor
node /path/to/herdr-orchestrate/dist/cli.mjs run start "describe the task" --size normal
node /path/to/herdr-orchestrate/dist/cli.mjs worker spawn research \
  --route default --prompt brief.md --run <run-id>
node /path/to/herdr-orchestrate/dist/cli.mjs worker spawn review \
  --route default --prompt review.md --run <run-id> --base <implementation-sha>
node /path/to/herdr-orchestrate/dist/cli.mjs worker send research \
  --text "focused follow-up" --run <run-id>
node /path/to/herdr-orchestrate/dist/cli.mjs board --run <run-id>
node /path/to/herdr-orchestrate/dist/cli.mjs wait --run <run-id>
node /path/to/herdr-orchestrate/dist/cli.mjs cleanup --run <run-id>
node /path/to/herdr-orchestrate/dist/cli.mjs cleanup --run <run-id> --apply
```

Run `wait` through Pi's background-command tool. That lets Pi end its current turn and wake when workers settle.

Durable state defaults to `~/dev/orch-v2`; override it with `ORCH_STATE_DIR`.

## Safety gates

- Every run gets a dedicated `<project>-orchestrate` workspace.
- The board occupies the first root pane; each worker gets one tab with one root pane.
- Workers use isolated worktrees and durable report paths.
- Cleanup previews before applying and preserves branches and reports.
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

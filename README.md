# herdr-orchestrate

Pi-native orchestration for visible [Herdr](https://herdr.dev) worker sessions.

`herdr-orchestrate` will provide a Herdr plugin, a durable run board, and Pi-only workers routed to explicit providers, models, and reasoning levels.

## Status

Bootstrap only. The first implementation milestone establishes versioned run state, Pi worker launching, and a read-only Herdr board.

## Current CLI

```bash
node dist/cli.mjs run start "describe the task" --size normal
node dist/cli.mjs worker spawn research --route default --prompt brief.md --run <run-id>
node dist/cli.mjs worker spawn map --route explore --prompt brief.md --run <run-id>
node dist/cli.mjs wait --run <run-id>
node dist/cli.mjs board --run <run-id>
```

Run `orch wait` through Pi's background command tool so the god session can end its turn and be woken when workers settle.

## Development

```bash
vp install
vp check
vp pack
```

# Orch worker report contract

The orch prompt names the exact report path. Write the full result there; keep chat output terse.

Use these sections when applicable:

- `## Outcome` — what changed or what was learned.
- `## Findings` — evidence, recommendation, review findings, or proof observations.
- `## Git` — base, branch, commit SHA, pushed state, and PR URL. Use `n/a` where the role is read-only.
- `## Checks` — exact commands and outcomes. Never claim a check that was not run.
- `## Live proof` — exact user path exercised and observed result, or `not requested`.
- `## Blockers` — `none` or a precise blocker and required decision.

End with exactly one completion marker:

```text
orch-verdict: done
```

or

```text
orch-verdict: blocked <reason>
```

A `done` report must contain enough evidence for the god session to act without reading source, diffs, panes, or raw test output.

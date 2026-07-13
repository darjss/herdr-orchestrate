# Worker routing

Use a **scout → analyst → author → reviewer** pipeline. The god session owns routing and decisions; workers never start nested workers.

## Routes

| Lane               | Route                         | Default thinking | Use for                                                                                           | Must not do                                                                 |
| ------------------ | ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Scout              | `explore` / DeepSeek v4 Flash | `high` (fixed)   | Read many files, locate relevant code, map symbols/callers/config, collect exact evidence         | Findings, severity, priorities, recommendations, trade-off decisions, edits |
| Analyst            | `fast` / GPT-5.6 Luna         | `medium`         | Research, diagnosis, planning, synthesis, bounded technical recommendations                       | Consequential product/architecture/security decisions outside the brief     |
| Author / proof     | `fast` / GPT-5.6 Luna         | `medium`         | Routine implementation, fixes, transformations, checks, and live proof                            | Silent escalation of scope or risk                                          |
| Decider / reviewer | `default` / GPT-5.6 Sol       | `medium`         | Consequential ambiguity, architecture, security, difficult debugging, and quality-critical review | Repeating bounded work that Luna can complete                               |

`medium` is the recommended default for both coding routes, including Sol. Use `low` only for trivial bounded work. Use `high` only after a medium pass produces concrete evidence that more reasoning is required, or when the user explicitly asks for it. Record the escalation reason in the worker brief. Reserve `xhigh` for explicit user escalation.

## Scout → analyst

Use a scout before an analyst when the task is input-heavy and the decision boundary is already clear.

1. Split file discovery by independent evidence source or subsystem.
2. Spawn bounded DeepSeek scouts. Their reports contain only relevant files, relationships, exact evidence, and unknowns.
3. Spawn one Luna analyst with the scout report paths. Luna verifies decisive evidence and makes the recommendation.
4. Escalate to Sol medium only when the remaining choice is consequential or Luna reports evidence-backed uncertainty.

A Luna worker does not call DeepSeek directly. If Luna discovers that broad file mapping is missing, it reports:

```md
## Scout request

- Question: <bounded factual question>
- Scope: <directories, symbols, or evidence sources>
- Needed evidence: <facts required before analysis can continue>
```

and ends with `orch-verdict: blocked scout evidence needed`. The god session spawns the scout, then sends the resulting report path back to the same Luna worker.

## Scout report contract

A scout report is complete only when it includes:

- every requested scope mapped to relevant files and symbols;
- caller/import/config relationships supported by paths and line references;
- exact commands or documents that define the observed behavior;
- unknowns that require an analyst or user decision;
- no findings, severity labels, priorities, recommendations, fix sketches, or preferred options.

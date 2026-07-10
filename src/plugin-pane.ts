#!/usr/bin/env node
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { board, latestRun, reconcileRun, startRun } from "./orch.js";
import type { TaskSize } from "./state.js";

function boardRepositoryRoot(): string {
  if (process.env.ORCH_REPO_ROOT) return process.env.ORCH_REPO_ROOT;
  try {
    const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON ?? "{}") as Record<
      string,
      unknown
    >;
    const pane = context.pane as Record<string, unknown> | undefined;
    const worktree = context.worktree as Record<string, unknown> | undefined;
    for (const value of [
      context.focused_pane_cwd,
      pane?.foreground_cwd,
      pane?.cwd,
      worktree?.path,
      context.workspace_cwd,
      context.cwd,
    ]) {
      if (typeof value === "string" && existsSync(value)) return value;
    }
  } catch {
    // A CLI-created board receives ORCH_REPO_ROOT and does not need plugin context.
  }
  throw new Error("Board pane has no target repository.");
}

async function renderBoard(): Promise<void> {
  const repoRoot = boardRepositoryRoot();
  for (;;) {
    const state = await latestRun(repoRoot);
    stdout.write("\u001b[2J\u001b[H");
    stdout.write(board(await reconcileRun(state.repoRoot, state.id)));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function main(): Promise<void> {
  const pane = process.argv[2] ?? process.env.HERDR_PLUGIN_ENTRYPOINT_ID;
  if (pane === "board") {
    await renderBoard();
    return;
  }
  if (pane === "run-wizard") {
    const reader = createInterface({ input: stdin, output: stdout });
    try {
      const goal = (await reader.question("Goal: ")).trim();
      const answer =
        (await reader.question("Size (trivial, normal, complex) [normal]: ")).trim() || "normal";
      if (!goal || !["trivial", "normal", "complex"].includes(answer))
        throw new Error("Goal and valid size are required.");
      const state = await startRun({ cwd: process.cwd(), goal, size: answer as TaskSize });
      console.log(`Started ${state.id}`);
    } finally {
      reader.close();
    }
    return;
  }
  throw new Error(`Unknown plugin pane '${pane ?? ""}'.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

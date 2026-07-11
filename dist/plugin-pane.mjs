#!/usr/bin/env node
import { a as reconcileRun, c as startRun, r as latestRun, t as board } from "./orch-CBLt0E7m.mjs";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
//#region src/plugin-pane.ts
function boardRepositoryRoot() {
	if (process.env.ORCH_REPO_ROOT) return process.env.ORCH_REPO_ROOT;
	try {
		const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON ?? "{}");
		const pane = context.pane;
		const worktree = context.worktree;
		for (const value of [
			context.focused_pane_cwd,
			pane?.foreground_cwd,
			pane?.cwd,
			worktree?.path,
			context.workspace_cwd,
			context.cwd
		]) if (typeof value === "string" && existsSync(value)) return value;
	} catch {}
	throw new Error("Board pane has no target repository.");
}
async function renderBoard() {
	const repoRoot = boardRepositoryRoot();
	for (;;) {
		const state = await latestRun(repoRoot);
		stdout.write("\x1B[2J\x1B[H");
		stdout.write(board(await reconcileRun(state.repoRoot, state.id)));
		await new Promise((resolve) => setTimeout(resolve, 2e3));
	}
}
async function main() {
	const pane = process.argv[2] ?? process.env.HERDR_PLUGIN_ENTRYPOINT_ID;
	if (pane === "board") {
		await renderBoard();
		return;
	}
	if (pane === "run-wizard") {
		const reader = createInterface({
			input: stdin,
			output: stdout
		});
		try {
			const goal = (await reader.question("Goal: ")).trim();
			const answer = (await reader.question("Size (trivial, normal, complex) [normal]: ")).trim() || "normal";
			if (!goal || ![
				"trivial",
				"normal",
				"complex"
			].includes(answer)) throw new Error("Goal and valid size are required.");
			const state = await startRun({
				cwd: process.cwd(),
				goal,
				size: answer
			});
			console.log(`Started ${state.id}`);
		} finally {
			reader.close();
		}
		return;
	}
	throw new Error(`Unknown plugin pane '${pane ?? ""}'.`);
}
main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
//#endregion
export {};

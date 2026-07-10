#!/usr/bin/env node
import { a as reconcileRun, c as startRun, r as latestRun, t as board } from "./orch-D1Vjr1m1.mjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
//#region src/plugin-pane.ts
async function renderBoard() {
	const repoRoot = process.env.ORCH_REPO_ROOT;
	if (!repoRoot) throw new Error("Board pane has no target repository.");
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

#!/usr/bin/env node
import { a as reconcileRun, c as startRun, r as latestRun, t as board } from "./orch-DvPRlHIO.mjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
//#region src/plugin-pane.ts
async function main() {
	const pane = process.argv[2] ?? process.env.HERDR_PLUGIN_ENTRYPOINT_ID;
	if (pane === "board") {
		const render = async () => {
			const state = await latestRun(process.cwd());
			console.log(board(await reconcileRun(state.repoRoot, state.id)));
		};
		await render();
		const reader = createInterface({
			input: stdin,
			output: stdout
		});
		try {
			for (;;) {
				if ((await reader.question("orch board (Enter refresh, q quit)> ")).trim() === "q") return;
				await render();
			}
		} finally {
			reader.close();
		}
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

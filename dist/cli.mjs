#!/usr/bin/env node
import { a as reconcileRun, c as startRun, n as doctor, o as sendWorker, r as latestRun, s as spawnWorker, t as board, u as loadRun } from "./orch-BG4EMi-g.mjs";
import { existsSync } from "node:fs";
//#region src/cli.ts
function usage() {
	throw new Error(`Usage:
  orch doctor
  orch run start <goal> [--size trivial|normal|complex] [--base REF]
  orch worker spawn <id> --route default|explore --prompt FILE --run RUN
  orch worker send <id> (--prompt FILE | --text TEXT) --run RUN
  orch wait [--run RUN] [--timeout SECONDS]
  orch cleanup [--run RUN] [--apply] [--force]
  orch board [--run RUN]`);
}
function invocationCwd() {
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
	return process.cwd();
}
function option(args, name) {
	const index = args.indexOf(name);
	if (index < 0) return void 0;
	const value = args[index + 1];
	if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
	return value;
}
async function main() {
	const args = process.argv.slice(2);
	const cwd = invocationCwd();
	if (args[0] === "doctor") {
		console.log((await doctor(cwd)).join("\n"));
		return;
	}
	if (args[0] === "run" && args[1] === "start") {
		const goal = args.slice(2).filter((value, index, values) => !value.startsWith("--") && values[index - 1] !== "--size" && values[index - 1] !== "--base").join(" ");
		if (!goal) usage();
		const size = option(args, "--size") ?? "normal";
		if (![
			"trivial",
			"normal",
			"complex"
		].includes(size)) throw new Error("--size must be trivial, normal, or complex.");
		const state = await startRun({
			cwd,
			goal,
			size,
			baseRef: option(args, "--base")
		});
		console.log(`Started ${state.id}\n${state.goal}`);
		return;
	}
	if (args[0] === "worker" && args[1] === "spawn") {
		const id = args[2];
		const route = option(args, "--route");
		const prompt = option(args, "--prompt");
		const runId = option(args, "--run");
		if (!id || !route || !prompt || !runId || !["default", "explore"].includes(route)) usage();
		const worker = await spawnWorker({
			repoRoot: (await latestRun(cwd)).repoRoot,
			runId,
			id,
			route,
			prompt
		});
		console.log(`Started ${worker.id} as ${worker.model.provider}/${worker.model.model}`);
		return;
	}
	if (args[0] === "worker" && args[1] === "send") {
		const id = args[2];
		const runId = option(args, "--run");
		const promptPath = option(args, "--prompt");
		const text = option(args, "--text");
		if (!id || !runId || !promptPath && !text || promptPath && text) usage();
		await sendWorker({
			repoRoot: (await latestRun(cwd)).repoRoot,
			runId,
			id,
			promptPath,
			text
		});
		console.log(`Sent ${id}`);
		return;
	}
	if (args[0] === "wait") {
		const timeout = Number(option(args, "--timeout") ?? "900") * 1e3;
		const selected = option(args, "--run");
		const initial = selected ? await loadRun((await latestRun(cwd)).repoRoot, selected) : await latestRun(cwd);
		const deadline = Date.now() + timeout;
		let waiting = true;
		while (waiting) {
			const state = await reconcileRun(initial.repoRoot, initial.id);
			const active = Object.values(state.workers).filter((worker) => worker.status === "working" || worker.status === "launching");
			const blocked = Object.values(state.workers).filter((worker) => worker.status === "blocked" || worker.status === "failed");
			if (blocked.length) throw new Error(`Workers need attention: ${blocked.map((worker) => worker.id).join(", ")}`);
			if (!active.length) {
				console.log("orch wait: settled");
				waiting = false;
				continue;
			}
			if (Date.now() >= deadline) throw new Error(`orch wait: timed out with ${active.map((worker) => worker.id).join(", ")}`);
			await new Promise((resolve) => setTimeout(resolve, 2e3));
		}
		return;
	}
	if (args[0] === "cleanup") {
		const { cleanupRun } = await import("./orch-BG4EMi-g.mjs").then((n) => n.i);
		const selected = option(args, "--run");
		const state = selected ? await loadRun((await latestRun(cwd)).repoRoot, selected) : await latestRun(cwd);
		console.log((await cleanupRun({
			repoRoot: state.repoRoot,
			runId: state.id,
			apply: args.includes("--apply"),
			force: args.includes("--force")
		})).join("\n"));
		return;
	}
	if (args[0] === "board") {
		const selected = option(args, "--run");
		const state = selected ? await loadRun((await latestRun(cwd)).repoRoot, selected) : await latestRun(cwd);
		console.log(board(await reconcileRun(state.repoRoot, state.id)));
		return;
	}
	usage();
}
main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
//#endregion
export {};

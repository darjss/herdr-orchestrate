import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/shell.ts
async function run(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.once("error", reject);
		child.once("close", (code) => code === 0 ? resolve({
			stdout,
			stderr
		}) : reject(/* @__PURE__ */ new Error(`${command} ${args.join(" ")} exited ${code}: ${stderr || stdout}`)));
	});
}
const THINKING_LEVELS = [
	"low",
	"medium",
	"high",
	"xhigh"
];
function isThinkingLevel(value) {
	return THINKING_LEVELS.includes(value);
}
const MODEL_ROUTES = {
	default: {
		provider: "openai-codex",
		model: "gpt-5.6-sol",
		thinking: "medium",
		writesSource: true,
		decides: true
	},
	fast: {
		provider: "openai-codex",
		model: "gpt-5.6-luna",
		thinking: "medium",
		writesSource: true,
		decides: true
	},
	explore: {
		provider: "opencode-go",
		model: "deepseek-v4-flash",
		thinking: "high",
		writesSource: false,
		decides: false
	}
};
function projectKey(repoRoot) {
	return `${repoRoot.split("/").filter(Boolean).at(-1) ?? "project"}-${createHash("sha256").update(repoRoot).digest("hex").slice(0, 8)}`;
}
function stateRoot(env = process.env) {
	return env.ORCH_STATE_DIR ?? resolve(env.HOME ?? ".", "dev/orch-v2");
}
function projectRoot(repoRoot, env = process.env) {
	return join(stateRoot(env), "projects", projectKey(repoRoot));
}
function runRoot(repoRoot, runId, env = process.env) {
	return join(projectRoot(repoRoot, env), "runs", runId);
}
function statePath(repoRoot, runId, env = process.env) {
	return join(runRoot(repoRoot, runId, env), "state.json");
}
async function createRun(input, env = process.env) {
	const id = `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const state = {
		schemaVersion: 2,
		id,
		goal: input.goal,
		size: input.size,
		repoRoot: input.repoRoot,
		baseRef: input.baseRef,
		createdAt: now,
		updatedAt: now,
		userMergeApprovedAt: null,
		herdrWorkspaceId: null,
		boardPaneId: null,
		workers: {}
	};
	const root = runRoot(input.repoRoot, id, env);
	await Promise.all([
		"prompts",
		"reports",
		"logs",
		"worktrees"
	].map((name) => mkdir(join(root, name), { recursive: true })));
	await saveRun(state, env);
	return state;
}
async function loadRun(repoRoot, runId, env = process.env) {
	const state = JSON.parse(await readFile(statePath(repoRoot, runId, env), "utf8"));
	state.schemaVersion = Math.max(state.schemaVersion ?? 1, 2);
	for (const worker of Object.values(state.workers ?? {})) {
		if (!Array.isArray(worker.reportPaths) || worker.reportPaths.length === 0) worker.reportPaths = worker.reportPath ? [worker.reportPath] : [];
		if (worker.blockedReason === void 0) worker.blockedReason = null;
	}
	return state;
}
async function saveRun(state, env = process.env) {
	state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	const path = statePath(state.repoRoot, state.id, env);
	await mkdir(join(path, ".."), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
	await rename(temporary, path);
}
//#endregion
//#region src/orch.ts
var orch_exports = /* @__PURE__ */ __exportAll({
	board: () => board,
	cleanupRun: () => cleanupRun,
	doctor: () => doctor,
	latestRun: () => latestRun,
	reconcileRun: () => reconcileRun,
	repositoryRoot: () => repositoryRoot,
	sendWorker: () => sendWorker,
	spawnWorker: () => spawnWorker,
	startRun: () => startRun
});
async function repositoryRoot(cwd) {
	return (await run("git", ["rev-parse", "--show-toplevel"], cwd)).stdout.trim();
}
async function startRun(input) {
	const repoRoot = await repositoryRoot(input.cwd);
	const baseRef = input.baseRef ?? (await run("git", [
		"symbolic-ref",
		"--quiet",
		"--short",
		"HEAD"
	], repoRoot)).stdout.trim();
	const previous = await latestRun(repoRoot).catch(() => null);
	const state = await createRun({
		repoRoot,
		goal: input.goal,
		size: input.size,
		baseRef
	});
	if (previous?.herdrWorkspaceId && previous.boardPaneId) {
		state.herdrWorkspaceId = previous.herdrWorkspaceId;
		state.boardPaneId = previous.boardPaneId;
		await saveRun(state);
		try {
			const panes = await workspacePanes(state);
			const boardPane = panes.find((pane) => pane.pane_id === previous.boardPaneId) ?? panes.find((pane) => pane.cwd === repoRoot);
			if (boardPane) {
				state.boardPaneId = boardPane.pane_id;
				await saveRun(state);
				await run("herdr", [
					"wait",
					"output",
					boardPane.pane_id,
					"--match",
					state.id,
					"--timeout",
					"10000"
				]);
				return state;
			}
		} catch {
			state.herdrWorkspaceId = null;
			state.boardPaneId = null;
			await saveRun(state);
		}
	}
	const workspace = await run("herdr", [
		"workspace",
		"create",
		"--cwd",
		repoRoot,
		"--label",
		`${repoRoot.split("/").filter(Boolean).at(-1)}-orchestrate`,
		"--no-focus"
	]);
	const workspaceResult = JSON.parse(workspace.stdout);
	const workspaceId = workspaceResult.result?.workspace?.workspace_id;
	const rootPaneId = workspaceResult.result?.root_pane?.pane_id;
	const rootTabId = workspaceResult.result?.root_pane?.tab_id;
	if (typeof workspaceId !== "string" || typeof rootPaneId !== "string" || typeof rootTabId !== "string") throw new Error("Herdr did not return the orchestration workspace, tab, and pane IDs.");
	state.herdrWorkspaceId = workspaceId;
	state.boardPaneId = rootPaneId;
	await saveRun(state);
	const boardEntrypoint = fileURLToPath(new URL("./plugin-pane.mjs", import.meta.url));
	const boardCommand = `exec env ORCH_REPO_ROOT=${JSON.stringify(repoRoot)} ${JSON.stringify(process.execPath)} ${JSON.stringify(boardEntrypoint)} board`;
	await run("herdr", [
		"tab",
		"rename",
		rootTabId,
		"orch board"
	]);
	await run("herdr", [
		"pane",
		"run",
		rootPaneId,
		boardCommand
	]);
	await run("herdr", [
		"wait",
		"output",
		rootPaneId,
		"--match",
		"# orch board",
		"--timeout",
		"10000"
	]);
	return state;
}
async function spawnWorker(input) {
	const model = modelForWorker(input.route, input.thinking);
	const state = await loadRun(input.repoRoot, input.runId);
	if (state.workers[input.id]) throw new Error(`Worker '${input.id}' already exists.`);
	const root = runRoot(state.repoRoot, state.id);
	const worktreePath = join(root, "worktrees", input.id);
	const promptPath = join(root, "prompts", `${input.id}-pass-1.md`);
	const reportDirectory = join(root, "reports", input.id);
	const reportPath = join(reportDirectory, "pass-1.md");
	const agentName = `orch-${state.id}-${input.id}`;
	const baseRef = input.baseRef ?? state.baseRef;
	const branch = model.writesSource ? `orch/${state.id}/${input.id}` : null;
	await mkdir(reportDirectory, { recursive: true });
	await writeFile(promptPath, workerPrompt(input.prompt, reportPath));
	if (branch) await run("git", [
		"worktree",
		"add",
		"-b",
		branch,
		worktreePath,
		baseRef
	], state.repoRoot);
	else await run("git", [
		"worktree",
		"add",
		"--detach",
		worktreePath,
		baseRef
	], state.repoRoot);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const worker = {
		id: input.id,
		route: input.route,
		model,
		status: "launching",
		agentName,
		paneId: null,
		tabId: null,
		worktreePath,
		branch,
		promptPaths: [promptPath],
		reportPath,
		reportPaths: [reportPath],
		verdict: null,
		blockedReason: null,
		proof: null,
		prUrl: null,
		createdAt: now,
		updatedAt: now
	};
	state.workers[worker.id] = worker;
	await saveRun(state);
	try {
		const workspaceId = state.herdrWorkspaceId;
		if (!workspaceId) throw new Error("Run has no orchestration workspace.");
		const tab = await run("herdr", [
			"tab",
			"create",
			"--workspace",
			workspaceId,
			"--label",
			input.id,
			"--no-focus"
		]);
		const tabResult = JSON.parse(tab.stdout);
		const rootPaneId = tabResult.result?.root_pane?.pane_id;
		worker.tabId = typeof tabResult.result?.tab?.tab_id === "string" ? tabResult.result.tab.tab_id : null;
		if (typeof rootPaneId !== "string") throw new Error(`Herdr did not return a root pane for worker '${input.id}'.`);
		const command = `cd ${JSON.stringify(worktreePath)} && exec pi --name ${JSON.stringify(agentName)} --provider ${JSON.stringify(model.provider)} --model ${JSON.stringify(model.model)} --thinking ${JSON.stringify(model.thinking)}`;
		worker.paneId = rootPaneId;
		await run("herdr", [
			"pane",
			"run",
			rootPaneId,
			command
		]);
		await run("herdr", [
			"wait",
			"agent-status",
			rootPaneId,
			"--status",
			"idle",
			"--timeout",
			"30000"
		]);
		await deliver(rootPaneId, promptPath);
		worker.status = "working";
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		await saveRun(state);
		return worker;
	} catch (error) {
		worker.status = "failed";
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		await saveRun(state);
		throw error;
	}
}
function modelForWorker(route, thinking) {
	const base = MODEL_ROUTES[route];
	if (!base) throw new Error(`Unknown worker route '${route}'.`);
	if (thinking !== void 0 && !isThinkingLevel(thinking)) throw new Error("--thinking must be low, medium, high, or xhigh.");
	if (route === "explore" && thinking !== void 0 && thinking !== "high") throw new Error("Explore workers only support --thinking high.");
	return {
		...base,
		thinking: thinking ?? base.thinking
	};
}
async function sendWorker(input) {
	const state = await loadRun(input.repoRoot, input.runId);
	const worker = state.workers[input.id];
	if (!worker) throw new Error(`Unknown worker '${input.id}'.`);
	const pass = worker.reportPaths.length + 1;
	const root = runRoot(state.repoRoot, state.id);
	const destination = join(root, "prompts", `${input.id}-pass-${pass}.md`);
	const reportPath = join(root, "reports", input.id, `pass-${pass}.md`);
	const prompt = input.promptPath ? await readFile(resolve(input.promptPath), "utf8") : input.text ?? "";
	await mkdir(join(root, "reports", input.id), { recursive: true });
	await writeFile(destination, workerPrompt(prompt, reportPath));
	try {
		const pane = await findWorkerPane(state, worker);
		if (!pane) throw new Error(`Worker '${worker.id}' has no live pane.`);
		worker.paneId = pane.pane_id;
		worker.tabId = pane.tab_id;
		await deliver(pane.pane_id, destination);
		worker.promptPaths.push(destination);
		worker.reportPaths.push(reportPath);
		worker.reportPath = reportPath;
		worker.verdict = null;
		worker.blockedReason = null;
		worker.status = "working";
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		await saveRun(state);
	} catch (error) {
		worker.status = "failed";
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		await saveRun(state);
		throw error;
	}
}
function workerPrompt(prompt, reportPath) {
	return `${prompt.trim()}\n\n## orch completion\nWrite your report to ${reportPath}. End it with: \`orch-verdict: done\` or \`orch-verdict: blocked <reason>\`.\n`;
}
async function deliver(paneId, promptPath) {
	const text = await readFile(promptPath, "utf8");
	try {
		await run("herdr", [
			"wait",
			"agent-status",
			paneId,
			"--status",
			"idle",
			"--timeout",
			"10000"
		]);
	} catch {}
	await run("herdr", [
		"pane",
		"send-text",
		paneId,
		text
	]);
	await run("herdr", [
		"pane",
		"send-keys",
		paneId,
		"Enter"
	]);
	try {
		await run("herdr", [
			"wait",
			"agent-status",
			paneId,
			"--status",
			"working",
			"--timeout",
			"10000"
		]);
	} catch {
		await run("herdr", [
			"pane",
			"send-keys",
			paneId,
			"Escape",
			"Enter"
		]);
		await run("herdr", [
			"pane",
			"send-text",
			paneId,
			text
		]);
		await run("herdr", [
			"pane",
			"send-keys",
			paneId,
			"Enter"
		]);
		await run("herdr", [
			"wait",
			"agent-status",
			paneId,
			"--status",
			"working",
			"--timeout",
			"10000"
		]);
	}
}
async function doctor(cwd) {
	const checks = [
		["git", ["--version"]],
		["herdr", ["--version"]],
		["pi", [
			"--provider",
			"openai-codex",
			"--model",
			"gpt-5.6-sol",
			"--thinking",
			"medium",
			"--no-tools",
			"--no-session",
			"--print",
			"ok"
		]],
		["pi", [
			"--provider",
			"opencode-go",
			"--model",
			"deepseek-v4-flash",
			"--thinking",
			"high",
			"--no-tools",
			"--no-session",
			"--print",
			"ok"
		]]
	];
	await repositoryRoot(cwd);
	const outcomes = [];
	for (const [command, args] of checks) {
		await run(command, args, cwd);
		outcomes.push(`${command}: ok`);
	}
	return outcomes;
}
async function workspacePanes(state) {
	if (!state.herdrWorkspaceId) return [];
	const response = await run("herdr", [
		"pane",
		"list",
		"--workspace",
		state.herdrWorkspaceId
	]);
	const panes = JSON.parse(response.stdout).result?.panes;
	return Array.isArray(panes) ? panes : [];
}
async function findWorkerPane(state, worker) {
	return (await workspacePanes(state)).find((pane) => pane.foreground_cwd === worker.worktreePath || pane.cwd === worker.worktreePath);
}
function finalReportVerdict(report) {
	const line = report.split(/\r?\n/).findLast((candidate) => candidate.trim().length > 0)?.trim();
	if (line === "orch-verdict: done") return {
		verdict: "done",
		blockedReason: null
	};
	const blocked = line?.match(/^orch-verdict: blocked(?:\s+(.+))?$/);
	if (blocked) return {
		verdict: "blocked",
		blockedReason: blocked[1]?.trim() || null
	};
	return null;
}
async function reconcileRun(repoRoot, runId) {
	const state = await loadRun(repoRoot, runId);
	const panes = await workspacePanes(state);
	for (const worker of Object.values(state.workers)) {
		const pane = panes.find((candidate) => candidate.foreground_cwd === worker.worktreePath || candidate.cwd === worker.worktreePath);
		const report = await readFile(worker.reportPath, "utf8").catch(() => null);
		const reportVerdict = report ? finalReportVerdict(report) : null;
		if (reportVerdict) {
			worker.status = reportVerdict.verdict;
			worker.verdict = reportVerdict.verdict;
			worker.blockedReason = reportVerdict.blockedReason;
		} else {
			worker.verdict = null;
			worker.blockedReason = null;
			if (!pane) worker.status = "failed";
			else {
				worker.paneId = pane.pane_id;
				worker.tabId = pane.tab_id;
				if (pane.agent_status === "blocked") worker.status = "blocked";
				else if (pane.agent_status === "working") worker.status = "working";
				else if (pane.agent_status === "done") worker.status = "done";
			}
		}
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	}
	await saveRun(state);
	return state;
}
async function cleanupRun(input) {
	const state = await loadRun(input.repoRoot, input.runId);
	const lines = [];
	for (const worker of Object.values(state.workers)) {
		lines.push(`${input.apply ? "remove" : "would remove"} worktree ${worker.worktreePath}`);
		lines.push(`${input.apply ? "close" : "would close"} worker ${worker.agentName}`);
		if (!input.apply) continue;
		if (!input.force && (worker.status === "working" || worker.status === "launching")) throw new Error(`Refusing to clean active worker '${worker.id}' without --force.`);
		try {
			const pane = await findWorkerPane(state, worker);
			if (pane) await run("herdr", [
				"tab",
				"close",
				pane.tab_id
			]);
		} catch {}
		try {
			await run("git", [
				"worktree",
				"remove",
				worker.worktreePath,
				...input.force ? ["--force"] : []
			], state.repoRoot);
		} catch (error) {
			if (!String(error).includes("is not a working tree")) throw error;
		}
	}
	return lines;
}
function board(state) {
	const lines = [
		`# orch board`,
		"",
		`Run: ${state.id}`,
		`Goal: ${state.goal}`,
		`Size: ${state.size}`,
		`Repo: ${state.repoRoot}`,
		`Merge approval: ${state.userMergeApprovedAt ?? "not approved"}`,
		"",
		"## Workers"
	];
	const workers = Object.values(state.workers);
	lines.push(...workers.length ? workers.map((worker) => `- ${worker.id}: ${worker.status}; ${worker.model.provider}/${worker.model.model}; ${worker.model.thinking}; report=${worker.reportPath}`) : ["- none"]);
	lines.push("", "## Next action", `- ${workers.some((worker) => worker.status === "blocked") ? "Unblock a worker with orch worker send." : "Inspect reports, then create the next worker through orch."}`);
	return `${lines.join("\n")}\n`;
}
async function latestRun(cwd) {
	const repoRoot = await repositoryRoot(cwd);
	const root = join(projectRoot(repoRoot), "runs");
	let entries;
	try {
		entries = await readdir(root);
	} catch (error) {
		if (error.code === "ENOENT") throw new Error("No orch runs found for this repository.");
		throw error;
	}
	if (!entries.length) throw new Error("No orch runs found for this repository.");
	return loadRun(repoRoot, entries.sort().at(-1));
}
//#endregion
export { reconcileRun as a, startRun as c, isThinkingLevel as d, loadRun as f, orch_exports as i, MODEL_ROUTES as l, doctor as n, sendWorker as o, latestRun as r, spawnWorker as s, board as t, THINKING_LEVELS as u };

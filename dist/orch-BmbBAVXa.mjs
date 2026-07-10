import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
const MODEL_ROUTES = {
	default: {
		provider: "openai-codex",
		model: "gpt-5.6-luna",
		thinking: "xhigh",
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
	return env.ORCH_STATE_DIR ?? resolve(env.HOME ?? ".", ".local/share/herdr-orchestrate");
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
		schemaVersion: 1,
		id,
		goal: input.goal,
		size: input.size,
		repoRoot: input.repoRoot,
		baseRef: input.baseRef,
		createdAt: now,
		updatedAt: now,
		userMergeApprovedAt: null,
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
	return JSON.parse(await readFile(statePath(repoRoot, runId, env), "utf8"));
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
	return createRun({
		repoRoot,
		goal: input.goal,
		size: input.size,
		baseRef
	});
}
async function spawnWorker(input) {
	const state = await loadRun(input.repoRoot, input.runId);
	if (state.workers[input.id]) throw new Error(`Worker '${input.id}' already exists.`);
	const model = MODEL_ROUTES[input.route];
	const root = runRoot(state.repoRoot, state.id);
	const worktreePath = join(root, "worktrees", input.id);
	const promptPath = join(root, "prompts", `${input.id}-pass-1.md`);
	const reportPath = join(root, "reports", `${input.id}.md`);
	const agentName = `orch-${state.id}-${input.id}`;
	const branch = model.writesSource ? `orch/${state.id}/${input.id}` : null;
	await writeFile(promptPath, workerPrompt(input.prompt, reportPath));
	if (branch) await run("git", [
		"worktree",
		"add",
		"-b",
		branch,
		worktreePath,
		state.baseRef
	], state.repoRoot);
	else await run("git", [
		"worktree",
		"add",
		"--detach",
		worktreePath,
		state.baseRef
	], state.repoRoot);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const worker = {
		id: input.id,
		route: input.route,
		model,
		status: "launching",
		agentName,
		worktreePath,
		branch,
		promptPaths: [promptPath],
		reportPath,
		verdict: null,
		proof: null,
		prUrl: null,
		createdAt: now,
		updatedAt: now
	};
	state.workers[worker.id] = worker;
	await saveRun(state);
	try {
		await run("herdr", [
			"agent",
			"start",
			agentName,
			"--cwd",
			worktreePath,
			"--no-focus",
			"--",
			"pi",
			"--provider",
			model.provider,
			"--model",
			model.model,
			"--thinking",
			model.thinking
		]);
		await run("herdr", [
			"agent",
			"wait",
			agentName,
			"--status",
			"idle",
			"--timeout",
			"30000"
		]);
		await deliver(agentName, promptPath);
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
async function sendWorker(input) {
	const state = await loadRun(input.repoRoot, input.runId);
	const worker = state.workers[input.id];
	if (!worker) throw new Error(`Unknown worker '${input.id}'.`);
	const pass = worker.promptPaths.length + 1;
	const destination = join(runRoot(state.repoRoot, state.id), "prompts", `${input.id}-pass-${pass}.md`);
	await writeFile(destination, workerPrompt(input.promptPath ? await readFile(resolve(input.promptPath), "utf8") : input.text ?? "", worker.reportPath));
	try {
		await deliver(worker.agentName, destination);
		worker.promptPaths.push(destination);
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
async function deliver(agentName, promptPath) {
	const text = await readFile(promptPath, "utf8");
	try {
		await run("herdr", [
			"agent",
			"wait",
			agentName,
			"--status",
			"idle",
			"--timeout",
			"10000"
		]);
	} catch {}
	const paneId = await agentPaneId(agentName);
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
			"agent",
			"wait",
			agentName,
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
			"agent",
			"wait",
			agentName,
			"--status",
			"working",
			"--timeout",
			"10000"
		]);
	}
}
async function agentPaneId(agentName) {
	const result = await run("herdr", [
		"agent",
		"get",
		agentName
	]);
	const paneId = JSON.parse(result.stdout).result?.agent?.pane_id;
	if (typeof paneId !== "string") throw new Error(`Herdr did not return a pane ID for ${agentName}.`);
	return paneId;
}
async function doctor(cwd) {
	const checks = [
		["git", ["--version"]],
		["herdr", ["--version"]],
		["pi", [
			"--provider",
			"openai-codex",
			"--model",
			"gpt-5.6-luna",
			"--thinking",
			"xhigh",
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
async function reconcileRun(repoRoot, runId) {
	const state = await loadRun(repoRoot, runId);
	for (const worker of Object.values(state.workers)) try {
		const response = await run("herdr", [
			"agent",
			"get",
			worker.agentName
		]);
		const status = JSON.parse(response.stdout).result?.agent?.agent_status;
		const report = await readFile(worker.reportPath, "utf8").catch(() => null);
		if (report?.includes("orch-verdict: blocked")) {
			worker.status = "blocked";
			worker.verdict = "blocked";
		} else if (report?.includes("orch-verdict: done")) {
			worker.status = "done";
			worker.verdict = "done";
		} else if (status === "blocked") worker.status = "blocked";
		else if (status === "working") worker.status = "working";
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	} catch {
		worker.status = "failed";
		worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	}
	await saveRun(state);
	return state;
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
export { sendWorker as a, MODEL_ROUTES as c, reconcileRun as i, loadRun as l, doctor as n, spawnWorker as o, latestRun as r, startRun as s, board as t };

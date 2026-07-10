import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run } from "./shell.js";
import {
  createRun,
  loadRun,
  MODEL_ROUTES,
  projectRoot,
  runRoot,
  saveRun,
  type Route,
  type RunState,
  type TaskSize,
  type Worker,
} from "./state.js";

export async function repositoryRoot(cwd: string): Promise<string> {
  return (await run("git", ["rev-parse", "--show-toplevel"], cwd)).stdout.trim();
}

export async function startRun(input: {
  cwd: string;
  goal: string;
  size: TaskSize;
  baseRef?: string;
}): Promise<RunState> {
  const repoRoot = await repositoryRoot(input.cwd);
  const baseRef =
    input.baseRef ??
    (await run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], repoRoot)).stdout.trim();
  return createRun({ repoRoot, goal: input.goal, size: input.size, baseRef });
}

export async function spawnWorker(input: {
  repoRoot: string;
  runId: string;
  id: string;
  route: Route;
  prompt: string;
}): Promise<Worker> {
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
  if (branch) {
    await run(
      "git",
      ["worktree", "add", "-b", branch, worktreePath, state.baseRef],
      state.repoRoot,
    );
  } else {
    await run("git", ["worktree", "add", "--detach", worktreePath, state.baseRef], state.repoRoot);
  }
  const now = new Date().toISOString();
  const worker: Worker = {
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
    updatedAt: now,
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
      model.thinking,
    ]);
    await run("herdr", ["agent", "wait", agentName, "--status", "idle", "--timeout", "30000"]);
    await deliver(agentName, promptPath);
    worker.status = "working";
    worker.updatedAt = new Date().toISOString();
    await saveRun(state);
    return worker;
  } catch (error) {
    worker.status = "failed";
    worker.updatedAt = new Date().toISOString();
    await saveRun(state);
    throw error;
  }
}

export async function sendWorker(input: {
  repoRoot: string;
  runId: string;
  id: string;
  text?: string;
  promptPath?: string;
}): Promise<void> {
  const state = await loadRun(input.repoRoot, input.runId);
  const worker = state.workers[input.id];
  if (!worker) throw new Error(`Unknown worker '${input.id}'.`);
  const pass = worker.promptPaths.length + 1;
  const destination = join(
    runRoot(state.repoRoot, state.id),
    "prompts",
    `${input.id}-pass-${pass}.md`,
  );
  const prompt = input.promptPath
    ? await readFile(resolve(input.promptPath), "utf8")
    : (input.text ?? "");
  await writeFile(destination, workerPrompt(prompt, worker.reportPath));
  try {
    await deliver(worker.agentName, destination);
    worker.promptPaths.push(destination);
    worker.status = "working";
    worker.updatedAt = new Date().toISOString();
    await saveRun(state);
  } catch (error) {
    worker.status = "failed";
    worker.updatedAt = new Date().toISOString();
    await saveRun(state);
    throw error;
  }
}

function workerPrompt(prompt: string, reportPath: string): string {
  return `${prompt.trim()}\n\n## orch completion\nWrite your report to ${reportPath}. End it with: \`orch-verdict: done\` or \`orch-verdict: blocked <reason>\`.\n`;
}

async function deliver(agentName: string, promptPath: string): Promise<void> {
  const text = await readFile(promptPath, "utf8");
  try {
    await run("herdr", ["agent", "wait", agentName, "--status", "idle", "--timeout", "10000"]);
  } catch {
    /* A working agent can accept a follow-up; delivery acknowledgement below is authoritative. */
  }
  const paneId = await agentPaneId(agentName);
  await run("herdr", ["pane", "send-text", paneId, text]);
  await run("herdr", ["pane", "send-keys", paneId, "Enter"]);
  try {
    await run("herdr", ["agent", "wait", agentName, "--status", "working", "--timeout", "10000"]);
  } catch {
    await run("herdr", ["pane", "send-keys", paneId, "Escape", "Enter"]);
    await run("herdr", ["pane", "send-text", paneId, text]);
    await run("herdr", ["pane", "send-keys", paneId, "Enter"]);
    await run("herdr", ["agent", "wait", agentName, "--status", "working", "--timeout", "10000"]);
  }
}

async function agentPaneId(agentName: string): Promise<string> {
  const result = await run("herdr", ["agent", "get", agentName]);
  const paneId = (JSON.parse(result.stdout) as { result?: { agent?: { pane_id?: unknown } } })
    .result?.agent?.pane_id;
  if (typeof paneId !== "string")
    throw new Error(`Herdr did not return a pane ID for ${agentName}.`);
  return paneId;
}

export async function doctor(cwd: string): Promise<string[]> {
  const checks: Array<[string, string[]]> = [
    ["git", ["--version"]],
    ["herdr", ["--version"]],
    [
      "pi",
      [
        "--provider",
        "openai-codex",
        "--model",
        "gpt-5.6-luna",
        "--thinking",
        "xhigh",
        "--no-tools",
        "--no-session",
        "--print",
        "ok",
      ],
    ],
    [
      "pi",
      [
        "--provider",
        "opencode-go",
        "--model",
        "deepseek-v4-flash",
        "--thinking",
        "high",
        "--no-tools",
        "--no-session",
        "--print",
        "ok",
      ],
    ],
  ];
  await repositoryRoot(cwd);
  const outcomes: string[] = [];
  for (const [command, args] of checks) {
    await run(command, args, cwd);
    outcomes.push(`${command}: ok`);
  }
  return outcomes;
}

export async function reconcileRun(repoRoot: string, runId: string): Promise<RunState> {
  const state = await loadRun(repoRoot, runId);
  for (const worker of Object.values(state.workers)) {
    try {
      const response = await run("herdr", ["agent", "get", worker.agentName]);
      const status = (
        JSON.parse(response.stdout) as { result?: { agent?: { agent_status?: unknown } } }
      ).result?.agent?.agent_status;
      const report = await readFile(worker.reportPath, "utf8").catch(() => null);
      if (report?.includes("orch-verdict: blocked")) {
        worker.status = "blocked";
        worker.verdict = "blocked";
      } else if (report?.includes("orch-verdict: done")) {
        worker.status = "done";
        worker.verdict = "done";
      } else if (status === "blocked") {
        worker.status = "blocked";
      } else if (status === "working") {
        worker.status = "working";
      }
      worker.updatedAt = new Date().toISOString();
    } catch {
      worker.status = "failed";
      worker.updatedAt = new Date().toISOString();
    }
  }
  await saveRun(state);
  return state;
}

export function board(state: RunState): string {
  const lines = [
    `# orch board`,
    "",
    `Run: ${state.id}`,
    `Goal: ${state.goal}`,
    `Size: ${state.size}`,
    `Repo: ${state.repoRoot}`,
    `Merge approval: ${state.userMergeApprovedAt ?? "not approved"}`,
    "",
    "## Workers",
  ];
  const workers = Object.values(state.workers);
  lines.push(
    ...(workers.length
      ? workers.map(
          (worker) =>
            `- ${worker.id}: ${worker.status}; ${worker.model.provider}/${worker.model.model}; ${worker.model.thinking}; report=${worker.reportPath}`,
        )
      : ["- none"]),
  );
  lines.push(
    "",
    "## Next action",
    `- ${workers.some((worker) => worker.status === "blocked") ? "Unblock a worker with orch worker send." : "Inspect reports, then create the next worker through orch."}`,
  );
  return `${lines.join("\n")}\n`;
}

export async function latestRun(cwd: string): Promise<RunState> {
  const repoRoot = await repositoryRoot(cwd);
  const root = join(projectRoot(repoRoot), "runs");
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error("No orch runs found for this repository.");
    throw error;
  }
  if (!entries.length) throw new Error("No orch runs found for this repository.");
  return loadRun(repoRoot, entries.sort().at(-1)!);
}

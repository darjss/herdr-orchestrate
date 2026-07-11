import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

export const SCHEMA_VERSION = 2;
export type Route = "default" | "explore";
export type TaskSize = "trivial" | "normal" | "complex";
export type WorkerStatus = "staged" | "launching" | "working" | "blocked" | "done" | "failed";

export interface ModelRoute {
  provider: string;
  model: string;
  thinking: "high" | "xhigh";
  writesSource: boolean;
  decides: boolean;
}

export const MODEL_ROUTES: Record<Route, ModelRoute> = {
  default: {
    provider: "openai-codex",
    model: "gpt-5.6-luna",
    thinking: "xhigh",
    writesSource: true,
    decides: true,
  },
  explore: {
    provider: "opencode-go",
    model: "deepseek-v4-flash",
    thinking: "high",
    writesSource: false,
    decides: false,
  },
};

export interface Worker {
  id: string;
  route: Route;
  model: ModelRoute;
  status: WorkerStatus;
  agentName: string;
  paneId: string | null;
  tabId: string | null;
  worktreePath: string;
  branch: string | null;
  promptPaths: string[];
  reportPath: string;
  reportPaths: string[];
  verdict: string | null;
  blockedReason: string | null;
  proof: string | null;
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunState {
  schemaVersion: number;
  id: string;
  goal: string;
  size: TaskSize;
  repoRoot: string;
  baseRef: string;
  createdAt: string;
  updatedAt: string;
  userMergeApprovedAt: string | null;
  herdrWorkspaceId: string | null;
  boardPaneId: string | null;
  workers: Record<string, Worker>;
}

export function projectKey(repoRoot: string): string {
  return `${repoRoot.split("/").filter(Boolean).at(-1) ?? "project"}-${createHash("sha256").update(repoRoot).digest("hex").slice(0, 8)}`;
}

export function stateRoot(env = process.env): string {
  return env.ORCH_STATE_DIR ?? resolve(env.HOME ?? ".", "dev/orch-v2");
}

export function projectRoot(repoRoot: string, env = process.env): string {
  return join(stateRoot(env), "projects", projectKey(repoRoot));
}

export function runRoot(repoRoot: string, runId: string, env = process.env): string {
  return join(projectRoot(repoRoot, env), "runs", runId);
}

export function statePath(repoRoot: string, runId: string, env = process.env): string {
  return join(runRoot(repoRoot, runId, env), "state.json");
}

export async function createRun(
  input: { repoRoot: string; goal: string; size: TaskSize; baseRef: string },
  env = process.env,
): Promise<RunState> {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const state: RunState = {
    schemaVersion: SCHEMA_VERSION,
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
    workers: {},
  };
  const root = runRoot(input.repoRoot, id, env);
  await Promise.all(
    ["prompts", "reports", "logs", "worktrees"].map((name) =>
      mkdir(join(root, name), { recursive: true }),
    ),
  );
  await saveRun(state, env);
  return state;
}

export async function loadRun(
  repoRoot: string,
  runId: string,
  env = process.env,
): Promise<RunState> {
  const state = JSON.parse(await readFile(statePath(repoRoot, runId, env), "utf8")) as RunState;
  state.schemaVersion = Math.max(state.schemaVersion ?? 1, SCHEMA_VERSION);
  for (const worker of Object.values(state.workers ?? {})) {
    if (!Array.isArray(worker.reportPaths) || worker.reportPaths.length === 0) {
      worker.reportPaths = worker.reportPath ? [worker.reportPath] : [];
    }
    if (worker.blockedReason === undefined) worker.blockedReason = null;
  }
  return state;
}

export async function saveRun(state: RunState, env = process.env): Promise<void> {
  state.updatedAt = new Date().toISOString();
  const path = statePath(state.repoRoot, state.id, env);
  await mkdir(join(path, ".."), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporary, path);
}

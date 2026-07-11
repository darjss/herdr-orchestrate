//#region src/state.d.ts
type Route = "default" | "fast" | "explore";
type TaskSize = "trivial" | "normal" | "complex";
declare const THINKING_LEVELS: readonly ["low", "medium", "high", "xhigh"];
type ThinkingLevel = (typeof THINKING_LEVELS)[number];
type WorkerStatus = "staged" | "launching" | "working" | "blocked" | "done" | "failed";
interface ModelRoute {
  provider: string;
  model: string;
  thinking: ThinkingLevel;
  writesSource: boolean;
  decides: boolean;
}
declare const MODEL_ROUTES: Record<Route, ModelRoute>;
interface Worker {
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
interface RunState {
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
//#endregion
//#region src/orch.d.ts
declare function startRun(input: {
  cwd: string;
  goal: string;
  size: TaskSize;
  baseRef?: string;
}): Promise<RunState>;
declare function spawnWorker(input: {
  repoRoot: string;
  runId: string;
  id: string;
  route: Route;
  prompt: string;
  thinking?: ThinkingLevel;
  baseRef?: string;
}): Promise<Worker>;
declare function sendWorker(input: {
  repoRoot: string;
  runId: string;
  id: string;
  text?: string;
  promptPath?: string;
}): Promise<void>;
declare function doctor(cwd: string): Promise<string[]>;
declare function reconcileRun(repoRoot: string, runId: string): Promise<RunState>;
declare function board(state: RunState): string;
declare function latestRun(cwd: string): Promise<RunState>;
//#endregion
export { MODEL_ROUTES, type ModelRoute, type Route, type RunState, THINKING_LEVELS, type TaskSize, type ThinkingLevel, type Worker, board, doctor, latestRun, reconcileRun, sendWorker, spawnWorker, startRun };
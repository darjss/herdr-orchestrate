#!/usr/bin/env node
import { board, doctor, latestRun, sendWorker, spawnWorker, startRun } from "./orch.js";
import { loadRun, type Route, type TaskSize } from "./state.js";

function usage(): never {
  throw new Error(`Usage:
  orch doctor
  orch run start <goal> [--size trivial|normal|complex] [--base REF]
  orch worker spawn <id> --route default|explore --prompt FILE --run RUN
  orch worker send <id> (--prompt FILE | --text TEXT) --run RUN
  orch board [--run RUN]`);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  if (args[0] === "doctor") {
    console.log((await doctor(cwd)).join("\n"));
    return;
  }
  if (args[0] === "run" && args[1] === "start") {
    const goal = args
      .slice(2)
      .filter(
        (value, index, values) =>
          !value.startsWith("--") &&
          values[index - 1] !== "--size" &&
          values[index - 1] !== "--base",
      )
      .join(" ");
    if (!goal) usage();
    const size = (option(args, "--size") ?? "normal") as TaskSize;
    if (!["trivial", "normal", "complex"].includes(size))
      throw new Error("--size must be trivial, normal, or complex.");
    const state = await startRun({ cwd, goal, size, baseRef: option(args, "--base") });
    console.log(`Started ${state.id}\n${state.goal}`);
    return;
  }
  if (args[0] === "worker" && args[1] === "spawn") {
    const id = args[2];
    const route = option(args, "--route") as Route | undefined;
    const prompt = option(args, "--prompt");
    const runId = option(args, "--run");
    if (!id || !route || !prompt || !runId || !["default", "explore"].includes(route)) usage();
    const state = await latestRun(cwd);
    const worker = await spawnWorker({ repoRoot: state.repoRoot, runId, id, route, prompt });
    console.log(`Started ${worker.id} as ${worker.model.provider}/${worker.model.model}`);
    return;
  }
  if (args[0] === "worker" && args[1] === "send") {
    const id = args[2];
    const runId = option(args, "--run");
    const promptPath = option(args, "--prompt");
    const text = option(args, "--text");
    if (!id || !runId || (!promptPath && !text) || (promptPath && text)) usage();
    const state = await latestRun(cwd);
    await sendWorker({ repoRoot: state.repoRoot, runId, id, promptPath, text });
    console.log(`Sent ${id}`);
    return;
  }
  if (args[0] === "board") {
    const selected = option(args, "--run");
    const state = selected
      ? await loadRun((await latestRun(cwd)).repoRoot, selected)
      : await latestRun(cwd);
    console.log(board(state));
    return;
  }
  usage();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function run(command: string, args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`${command} ${args.join(" ")} exited ${code}: ${stderr || stdout}`)),
    );
  });
}

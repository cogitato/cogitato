import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findProject, type Project } from "@cogitato/kit-cli";
import { createServer } from "./server.js";

export { SERVER_NAME, createServer } from "./server.js";

/**
 * The prototype the server works on: KIT_PROJECT (set by the plugin), then
 * CLAUDE_PROJECT_DIR, then the working directory, each searched upward for design/contract.
 */
export function resolveProject(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Project | undefined {
  for (const start of [env.KIT_PROJECT, env.CLAUDE_PROJECT_DIR, cwd]) {
    const p = start ? findProject(start) : undefined;
    if (p) return p;
  }
  return undefined;
}

/** Starts the server on stdio. */
export async function serveStdio(): Promise<void> {
  const project = resolveProject();
  if (!project) {
    process.stderr.write("kit-mcp: this folder isn't a Cogitato prototype (no design/contract folder here or above it).\n");
    process.exitCode = 1;
    return;
  }
  await createServer(project).connect(new StdioServerTransport());
}

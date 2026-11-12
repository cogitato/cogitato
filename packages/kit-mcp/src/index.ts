import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findWorkspace, type Workspace } from "@cogitato/kit-cli";
import { createServer } from "./server.js";

export { SERVER_NAME, createServer } from "./server.js";

/**
 * The workspace the server works on: KIT_PROJECT (set by the plugin), then
 * CLAUDE_PROJECT_DIR, then the working directory, each searched upward for design/contract. The prototype is chosen per call.
 */
export function resolveWorkspace(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Workspace | undefined {
  for (const start of [env.KIT_PROJECT, env.CLAUDE_PROJECT_DIR, cwd]) {
    const ws = start ? findWorkspace(start) : undefined;
    if (ws) return ws;
  }
  return undefined;
}

/** Starts the server on stdio. */
export async function serveStdio(): Promise<void> {
  const ws = resolveWorkspace();
  if (!ws) {
    process.stderr.write("kit-mcp: this folder isn't a Cogitato workspace (no design/contract folder here or above it).\n");
    process.exitCode = 1;
    return;
  }
  await createServer(ws).connect(new StdioServerTransport());
}

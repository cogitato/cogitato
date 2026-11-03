import { spawn, type ChildProcess } from "node:child_process";
import { DEFAULT_PORT, isServerUp } from "./doctor.js";
import type { Project } from "./project.js";

export const KIT_PATH = "/__kit";

export interface PreviewOptions {
  port?: number;
  open?: boolean;
  /** Called with progress messages for the person running the command. */
  log?: (message: string) => void;
}

export interface PreviewResult {
  url: string;
  /** The dev server Cogitato started, if it wasn't already running. Resolves when it exits. */
  server?: ChildProcess;
}

function openInBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

/** Makes sure the prototype is running, then opens its /__kit page with every token and component. */
export async function preview(project: Project, opts: PreviewOptions = {}): Promise<PreviewResult> {
  const port = opts.port ?? DEFAULT_PORT;
  const url = `http://localhost:${port}${KIT_PATH}`;
  const log = opts.log ?? (() => {});

  let server: ChildProcess | undefined;
  if (!(await isServerUp(port))) {
    log("Starting the prototype...");
    server = spawn("pnpm", ["exec", "vite", "--port", String(port), "--strictPort"], {
      cwd: project.root,
      stdio: "inherit",
      shell: true,
    });
    const deadline = Date.now() + 30_000;
    while (!(await isServerUp(port))) {
      if (server.exitCode !== null || Date.now() > deadline) {
        throw new Error("The prototype didn't start. Run kit doctor to see what's missing.");
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  log(`The design kit is at ${url}`);
  if (opts.open !== false) openInBrowser(url);
  return { url, ...(server ? { server } : {}) };
}

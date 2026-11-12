import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { validateProject } from "@cogitato/contract";
import { buildManifest, readFlowsJson, sameManifest } from "./flows.js";
import { LAYOUT, WORKSPACE_LAYOUT, sourceFiles, type Project } from "./project.js";
import { readRegistry } from "./registry.js";

export type CheckStatus = "ok" | "warning" | "problem";

export interface DoctorCheck {
  id: string;
  status: CheckStatus;
  /** One plain-language line: what's wrong and how to fix it, or what's fine. */
  message: string;
}

export interface DoctorOptions {
  /** Port the prototype's dev server uses. */
  port?: number;
  /** For tests: skip slow checks that touch the network or spawn processes. */
  offline?: boolean;
}

export const DEFAULT_PORT = 5173;

export async function isServerUp(port: number, timeoutMs = 800): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function envKeys(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l)?.[1])
    .filter((k): k is string => Boolean(k));
}

/** Machine health check for a prototype. Every message is written for a designer. */
export async function doctor(project: Project, opts: DoctorOptions = {}): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const add = (id: string, status: CheckStatus, message: string) => checks.push({ id, status, message });

  const major = Number(process.versions.node.split(".")[0]);
  add(
    "node",
    major >= 22 ? "ok" : "problem",
    major >= 22 ? `Node ${process.versions.node} is installed.` : `Node ${process.versions.node} is too old. Cogitato needs Node 22 or newer.`,
  );

  if (!opts.offline) {
    const pnpm = spawnSync("pnpm", ["--version"], { encoding: "utf8", shell: true });
    add(
      "pnpm",
      pnpm.status === 0 ? "ok" : "problem",
      pnpm.status === 0 ? `pnpm ${pnpm.stdout.trim()} is installed.` : "pnpm isn't installed. It's needed to install the prototype's parts.",
    );
  }

  const installed =
    ["@cogitato/contract", "@cogitato/kit-mcp"].every((p) => existsSync(project.workspace.abs(`node_modules/${p}/package.json`))) &&
    existsSync(project.abs("node_modules/@cogitato/runtime/package.json"));
  add(
    "dependencies",
    installed ? "ok" : "problem",
    installed ? "The prototype's parts are installed." : "The prototype's parts aren't installed yet. Run the setup (pnpm install) once.",
  );

  const contract = validateProject(project.abs(LAYOUT.design), project.workspace.abs(WORKSPACE_LAYOUT.contract));
  const contractErrors = contract.issues.filter((i) => i.severity === "error").length;
  add(
    "contract",
    contractErrors ? "problem" : "ok",
    contractErrors
      ? `The design contract has ${contractErrors} problem${contractErrors === 1 ? "" : "s"}. Run kit validate to see them.`
      : "The design contract is valid.",
  );

  const existing = readFlowsJson(project);
  const registry = readRegistry(project, sourceFiles(project));
  const built = buildManifest(registry);
  add(
    "flows",
    !existing ? "warning" : sameManifest(existing, built.manifest) ? "ok" : "warning",
    !existing
      ? "flows.json hasn't been created yet. Run kit export-flows."
      : sameManifest(existing, built.manifest)
        ? "flows.json is up to date."
        : "flows.json is out of date. Run kit export-flows.",
  );

  if (!opts.offline) {
    const port = opts.port ?? DEFAULT_PORT;
    const up = await isServerUp(port);
    add(
      "dev-server",
      up ? "ok" : "warning",
      up ? `The prototype is running at http://localhost:${port}.` : `The prototype isn't running. Start it to see your screens (port ${port}).`,
    );
  }

  const needed = envKeys(project.abs(".env.example"));
  const present = new Set(envKeys(project.abs(".env")));
  const missing = needed.filter((k) => !present.has(k));
  add(
    "env",
    missing.length ? "problem" : "ok",
    missing.length
      ? `Some settings are missing from .env: ${missing.join(", ")}. Ask a developer for the values.`
      : needed.length
        ? "All settings in .env are present."
        : "No settings are needed.",
  );
  return checks;
}

export function formatDoctor(checks: DoctorCheck[], quiet = false): string {
  const shown = quiet ? checks.filter((c) => c.status === "problem") : checks;
  if (quiet && shown.length === 0) return "";
  const mark = { ok: "ok     ", warning: "check  ", problem: "PROBLEM" } as const;
  return shown.map((c) => `${mark[c.status]}  ${c.message}`).join("\n");
}

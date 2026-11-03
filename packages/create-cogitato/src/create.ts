import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `npm create cogitato@latest my-prototype`: a new prototype from the bundled template, pinned to
// this release. Messages are for designers as much as developers: plain words, no jargon.

export const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "template");

export interface CreateOptions {
  /** Folder to create. */
  target: string;
  /** Run `pnpm install` when pnpm is available. Default true. */
  install?: boolean;
  /** Start git history with a first commit. Default true. */
  git?: boolean;
  log?: (message: string) => void;
  /** For tests. */
  templateDir?: string;
}

export interface CreateResult {
  dir: string;
  name: string;
  installed: boolean;
  git: "committed" | "initialized" | "skipped";
}

export class CreateError extends Error {
  override name = "CreateError";
}

/** A package name from the folder name: "My Checkout" -> "my-checkout". */
export function packageName(folder: string): string {
  return basename(folder).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "") || "my-prototype";
}

// pnpm is a .cmd shim on Windows, so it needs a shell there; git is a real executable and must not
// get one, or arguments with spaces (the commit message) are split up.
const needsShell = (cmd: string) => process.platform === "win32" && cmd !== "git";
const has = (cmd: string) => spawnSync(cmd, ["--version"], { stdio: "ignore", shell: needsShell(cmd) }).status === 0;
const run = (cmd: string, args: string[], cwd: string) =>
  spawnSync(cmd, args, { cwd, stdio: "inherit", shell: needsShell(cmd) }).status === 0;

export function createPrototype(opts: CreateOptions): CreateResult {
  const log = opts.log ?? (() => {});
  const template = opts.templateDir ?? TEMPLATE_DIR;
  if (!existsSync(template)) throw new CreateError("This copy of create-cogitato has no template in it. Reinstall it, or report the problem.");
  const dir = resolve(opts.target);
  if (existsSync(dir) && readdirSync(dir).length) {
    throw new CreateError(`The folder "${opts.target}" already has files in it. Pick a new folder name.`);
  }

  cpSync(template, dir, { recursive: true });
  if (existsSync(join(dir, "_gitignore"))) renameSync(join(dir, "_gitignore"), join(dir, ".gitignore"));
  const name = packageName(dir);
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  writeFileSync(pkgPath, JSON.stringify({ ...pkg, name }, null, 2) + "\n");
  log(`Created the prototype in ${dir}.`);

  let installed = false;
  if (opts.install !== false) {
    if (has("pnpm")) {
      log("Installing its parts (this takes a minute)...");
      installed = run("pnpm", ["install"], dir);
      if (!installed) log("Installing didn't finish. Open the folder in Claude Code and ask it to set up this computer.");
    } else {
      log("pnpm isn't installed, so the prototype's parts weren't installed yet. Claude can do it: open the folder and ask it to set up this computer.");
    }
  }

  let git: CreateResult["git"] = "skipped";
  if (opts.git !== false && has("git")) {
    if (run("git", ["init", "-q"], dir)) {
      git = "initialized";
      if (run("git", ["add", "-A"], dir) && run("git", ["commit", "-q", "-m", "Start the prototype from Cogitato"], dir)) git = "committed";
      // Usually git doesn't know your name and email yet. Saving a version later sorts it out.
      else log("Git history is started, but the first save didn't happen. That's fine: open the folder in Claude Code and ask it to set up this computer.");
    }
  }
  return { dir, name, installed, git };
}

const USAGE = `Start a new Cogitato prototype.

  npm create cogitato@latest <folder> [-- --no-install] [--no-git]

Then open the folder in Claude Code and describe your first screen.`;

/** CLI entry. Returns the exit code. */
export async function main(argv: string[]): Promise<number> {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [target] = argv.filter((a) => !a.startsWith("--"));
  if (flags.has("--help") || !target) {
    console.log(USAGE);
    return target ? 0 : 1;
  }
  try {
    const r = createPrototype({ target, install: !flags.has("--no-install"), git: !flags.has("--no-git"), log: console.log });
    console.log(
      [
        "",
        `Your prototype "${r.name}" is ready.`,
        `Next: open ${r.dir} in Claude Code, and describe the first screen you want, like "add a sign-up screen".`,
        "It starts with the Acme Shop example design system; swap in your own in design/contract/.",
      ].join("\n"),
    );
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

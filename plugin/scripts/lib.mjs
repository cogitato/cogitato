// Shared by the plugin's launchers. No dependencies: the plugin ships no node_modules, and the
// real work is done by the kit packages the prototype itself has installed (ADR 010).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Walks up from `from` to the folder holding design/contract (a Cogitato prototype). */
export function findPrototype(from) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "design", "contract"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Path of a file inside one of the prototype's installed @cogitato packages, if it's there. */
export function installed(root, pkg, file) {
  const path = join(root, "node_modules", "@cogitato", pkg, file);
  return existsSync(path) ? path : undefined;
}

/** Where to start looking for the prototype. */
export function startDir(input = {}) {
  return process.env.KIT_PROJECT || process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

export const NOT_INSTALLED =
  "Cogitato's tools aren't installed in this prototype yet, so screens can't be checked or created. Ask Claude to set up this computer.";

// Copies templates/workspace-react into this package's template/ folder for publishing, pinned to
// this release: every workspace:* dependency becomes ^<version>, and the fixed version group
// (ADR 016) means this package's version is every @cogitato package's version.
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");
const source = join(pkgDir, "..", "..", "templates", "workspace-react");
const out = join(pkgDir, "template");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

const SKIP = new Set(["node_modules", "dist", ".env"]);
rmSync(out, { recursive: true, force: true });
cpSync(source, out, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });

// npm drops .gitignore from published packages; create-cogitato renames it back.
renameSync(join(out, ".gitignore"), join(out, "_gitignore"));

// The workspace's root and every prototype are the customer's work, not part of Cogitato: no
// license or blurb of ours, and every workspace:* dependency pinned to this release.
function pin(pkgPath, name) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const field of ["dependencies", "devDependencies"]) {
    for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
      // A canary (0.0.0-canary-<commit>) pins exactly: a ^ range could pick up another canary.
      if (String(range).startsWith("workspace:")) pkg[field][dep] = version.includes("-") ? version : `^${version}`;
    }
  }
  const { license: _l, description: _d, ...rest } = pkg;
  writeFileSync(pkgPath, JSON.stringify({ ...rest, name, ...(name === "my-design" ? { version: "0.1.0" } : {}) }, null, 2) + "\n");
}

pin(join(out, "package.json"), "my-design");

// _pnpm-workspace.yaml stays as it is: create-cogitato renames it, and the underscore keeps a
// create run inside another pnpm workspace from nesting one.
const prototypesDir = join(out, "prototypes");
for (const folder of existsSync(prototypesDir) ? readdirSync(prototypesDir) : []) {
  const dir = join(prototypesDir, folder);
  if (existsSync(join(dir, "package.json"))) pin(join(dir, "package.json"), folder);
  // Generated flow map: keep it, minus the commit it was exported at.
  const flowsPath = join(dir, "design", "flows.json");
  if (existsSync(flowsPath)) {
    const { commit: _c, ...flows } = JSON.parse(readFileSync(flowsPath, "utf8"));
    writeFileSync(flowsPath, JSON.stringify(flows, null, 2) + "\n");
  }
}
console.log(`Bundled the workspace template at ${version}.`);

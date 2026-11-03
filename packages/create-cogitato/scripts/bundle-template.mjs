// Copies templates/prototype-react into this package's template/ folder for publishing, pinned to
// this release: every workspace:* dependency becomes ^<version>, and the fixed version group
// (ADR 016) means this package's version is every @cogitato package's version.
import { cpSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");
const source = join(pkgDir, "..", "..", "templates", "prototype-react");
const out = join(pkgDir, "template");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

const SKIP = new Set(["node_modules", "dist", ".env"]);
rmSync(out, { recursive: true, force: true });
cpSync(source, out, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });

// npm drops .gitignore from published packages; create-cogitato renames it back.
renameSync(join(out, ".gitignore"), join(out, "_gitignore"));

const pkgPath = join(out, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
for (const field of ["dependencies", "devDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (String(range).startsWith("workspace:")) pkg[field][name] = `^${version}`;
  }
}
// The new prototype is the customer's work, not part of Cogitato: no name, license or blurb of ours.
const { license: _l, description: _d, ...rest } = pkg;
writeFileSync(pkgPath, JSON.stringify({ ...rest, name: "my-prototype", version: "0.1.0" }, null, 2) + "\n");

// pnpm 10+ only runs dependency build scripts a project allows. Vite needs esbuild's. (Inside the
// monorepo the root pnpm-workspace.yaml allows it; a nested one there would split the workspace.)
writeFileSync(join(out, "pnpm-workspace.yaml"), "allowBuilds:\n  esbuild: true\n");

// Generated flow map: keep it, minus the commit it was exported at.
const flowsPath = join(out, "design", "flows.json");
if (existsSync(flowsPath)) {
  const { commit: _c, ...flows } = JSON.parse(readFileSync(flowsPath, "utf8"));
  writeFileSync(flowsPath, JSON.stringify(flows, null, 2) + "\n");
}
console.log(`Bundled the prototype template at ${version}.`);

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateProject, type ValidationResult } from "@cogitato/contract";
import { KitError } from "./errors.js";
import { exportFlows } from "./export-flows.js";
import { createScreen } from "./scaffold.js";
import { parseSource, type Issue } from "./issue.js";
import { LAYOUT, WORKSPACE_LAYOUT, listPrototypes, projectIn, readContract, type Workspace } from "./project.js";
import { checkCssFile } from "./rules/css.js";
import { checkTsxFile, duplicateKitIds, type KitIdUse } from "./rules/tsx.js";
import { sortIssues, validate } from "./validate.js";

// Work across every prototype in a workspace.

/** Every .css and .tsx file in the shared kit, workspace-relative, sorted. */
function kitFiles(ws: Workspace): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx|css)$/.test(name) && !name.endsWith(".d.ts")) out.push(ws.rel(path));
    }
  };
  walk(ws.abs(WORKSPACE_LAYOUT.kit));
  return out.sort();
}

/** Checks the shared kit's CSS and TSX against the contract. Issue files are workspace-relative. */
export function validateKit(ws: Workspace): Issue[] {
  const issues: Issue[] = [];
  const view = readContract(ws);
  const kitIds: KitIdUse[] = [];
  for (const file of kitFiles(ws)) {
    const text = readFileSync(ws.abs(file), "utf8");
    if (file.endsWith(".css")) {
      issues.push(...checkCssFile(file, text, view));
    } else {
      const r = checkTsxFile(parseSource(file, text), { contract: view, inKit: true });
      kitIds.push(...r.kitIds);
      issues.push(...r.issues);
    }
  }
  issues.push(...duplicateKitIds(kitIds));
  return issues;
}

/** Checks the shared contract and kit once, then every prototype. Issue files are workspace-relative. */
export function validateWorkspace(ws: Workspace, opts: { contractOnly?: boolean } = {}): ValidationResult {
  const issues: Issue[] = [];
  const contract = validateProject(ws.abs(LAYOUT.design), ws.abs(WORKSPACE_LAYOUT.contract));
  issues.push(
    ...contract.issues
      .filter((i) => i.file.startsWith("contract/"))
      .map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.contract}/${i.file.slice("contract/".length)}` })),
  );
  if (opts.contractOnly) return { ok: !issues.some((i) => i.severity === "error"), issues: sortIssues(issues) };
  issues.push(...validateKit(ws));

  for (const name of listPrototypes(ws)) {
    const r = validate(projectIn(ws, name), { skipContract: true });
    issues.push(...r.issues.map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.prototypes}/${name}/${i.file}` })));
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues: sortIssues(issues) };
}

// Files a new prototype copies from an existing one, so it gets the same pinned versions and setup.
const SKELETON = ["package.json", "index.html", "vite.config.ts", "tsconfig.json", "netlify.toml", "src/main.tsx", "src/styles/global.css"];

const EMPTY_FLOWS = `import { defineFlows } from "@cogitato/runtime";

// How screens connect. Each step is "{screen id}.{state}". \`kit export-flows\` turns this into
// design/flows.json for the canvas; steps appear in the order they're first mentioned.
export default defineFlows([]);
`;

/** Starts prototypes/<name>/ from an existing prototype's setup, with one empty Home screen. */
export function createPrototype(ws: Workspace, name: string): { name: string; files: string[] } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new KitError(`"${name}" can't be a prototype name. Use lowercase words with dashes, like "onboarding" or "account-settings".`);
  }
  const existing = listPrototypes(ws);
  if (existing.includes(name)) throw new KitError(`There's already a prototype called "${name}". Pick another name.`);
  if (!existing.length) throw new KitError("There's no prototype here to copy the setup from. Ask a developer to check the workspace.");
  const from = ws.abs(`${WORKSPACE_LAYOUT.prototypes}/${existing[0]}`);
  const to = ws.abs(`${WORKSPACE_LAYOUT.prototypes}/${name}`);
  const files: string[] = [];
  for (const rel of SKELETON) {
    if (!existsSync(join(from, rel))) continue;
    mkdirSync(join(to, rel, ".."), { recursive: true });
    copyFileSync(join(from, rel), join(to, rel));
    files.push(`${WORKSPACE_LAYOUT.prototypes}/${name}/${rel}`);
  }
  const pkgPath = join(to, "package.json");
  writeFileSync(pkgPath, JSON.stringify({ ...JSON.parse(readFileSync(pkgPath, "utf8")), name }, null, 2) + "\n");
  const html = join(to, "index.html");
  if (existsSync(html)) writeFileSync(html, readFileSync(html, "utf8").replace(/<title>[^<]*<\/title>/, `<title>${name} prototype</title>`));
  mkdirSync(join(to, LAYOUT.design), { recursive: true });
  mkdirSync(join(to, "src", "screens"), { recursive: true });
  writeFileSync(join(to, "src", "flows.ts"), EMPTY_FLOWS);
  files.push(`${WORKSPACE_LAYOUT.prototypes}/${name}/src/flows.ts`);
  const project = projectIn(ws, name);
  const screen = createScreen(project, { id: "home", route: "/", title: "Home" });
  files.push(...screen.files.map((f) => `${WORKSPACE_LAYOUT.prototypes}/${name}/${f}`));
  exportFlows(project);
  return { name, files };
}

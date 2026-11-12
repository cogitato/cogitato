import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateProject, type ValidationResult } from "@cogitato/contract";
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

/** Checks the shared contract and kit once, then every prototype. Issue files are workspace-relative. */
export function validateWorkspace(ws: Workspace): ValidationResult {
  const issues: Issue[] = [];
  const contract = validateProject(ws.abs(LAYOUT.design), ws.abs(WORKSPACE_LAYOUT.contract));
  issues.push(
    ...contract.issues
      .filter((i) => i.file.startsWith("contract/"))
      .map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.contract}/${i.file.slice("contract/".length)}` })),
  );

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

  for (const name of listPrototypes(ws)) {
    const r = validate(projectIn(ws, name), { skipContract: true });
    issues.push(...r.issues.map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.prototypes}/${name}/${i.file}` })));
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues: sortIssues(issues) };
}

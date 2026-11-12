import { validateProject, type ValidationResult } from "@cogitato/contract";
import type { Issue } from "./issue.js";
import { WORKSPACE_LAYOUT, listPrototypes, projectIn, type Workspace } from "./project.js";
import { validate } from "./validate.js";

// Work across every prototype in a workspace.

/** Checks the shared contract once, then every prototype. Issue files are workspace-relative. */
export function validateWorkspace(ws: Workspace): ValidationResult {
  const issues: Issue[] = [];
  const contract = validateProject(ws.abs("design"), ws.abs(WORKSPACE_LAYOUT.contract));
  issues.push(
    ...contract.issues
      .filter((i) => i.file.startsWith("contract/"))
      .map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.contract}/${i.file.slice("contract/".length)}` })),
  );
  for (const name of listPrototypes(ws)) {
    const r = validate(projectIn(ws, name), { skipContract: true });
    issues.push(...r.issues.map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.prototypes}/${name}/${i.file}` })));
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

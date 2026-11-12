import { readFileSync } from "node:fs";
import { validateProject, type ValidationResult } from "@cogitato/contract";
import { buildManifest, staleIssue } from "./flows.js";
import type { Issue } from "./issue.js";
import { LAYOUT, WORKSPACE_LAYOUT, isScreenFile, readContract, sourceFiles, type Project } from "./project.js";
import { parseProjectFile, readRegistry, type ScreenEntry } from "./registry.js";
import { checkCssFile } from "./rules/css.js";
import { checkTsxFile, duplicateKitIds, type KitIdUse } from "./rules/tsx.js";

export interface ValidateOptions {
  /** Only check the design contract (the workspace's design/contract and this prototype's design/ files). */
  contractOnly?: boolean;
  /** Don't check the shared contract (validateWorkspace checks it once). */
  skipContract?: boolean;
  /**
   * Only check these files (project-relative or absolute). The fast path for edit hooks.
   * Screen registrations and flows are still read from the whole project, since ids and flow
   * steps depend on every screen.
   */
  files?: string[];
}

const ownerOf = (screens: ScreenEntry[], file: string): ScreenEntry | undefined =>
  screens
    .filter((s) => file.startsWith(`${s.dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length)[0];

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0),
  );
}

const finish = (issues: Issue[]): ValidationResult => ({
  ok: !issues.some((i) => i.severity === "error"),
  issues: sortIssues(issues),
});

/** Validates a prototype: its design contract, its code against the contract, and its flows. */
export function validate(project: Project, opts: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const targets = opts.files?.map((f) => project.rel(f));
  const touches = (pred: (f: string) => boolean) => !targets || targets.some(pred);

  const sharedPrefix = `../../${WORKSPACE_LAYOUT.contract}/`;
  if (touches((f) => f.startsWith(`${LAYOUT.design}/`) || f.startsWith(sharedPrefix))) {
    const contractDir = project.workspace.abs(WORKSPACE_LAYOUT.contract);
    const r = validateProject(project.abs(LAYOUT.design), contractDir);
    for (const i of r.issues) {
      const shared = i.file.startsWith("contract/");
      if (shared && opts.skipContract) continue;
      // Contract issues are named from the workspace root, prototype issues from the prototype.
      issues.push({ ...i, file: shared ? `${WORKSPACE_LAYOUT.contract}/${i.file.slice("contract/".length)}` : `${LAYOUT.design}/${i.file}` });
    }
  }
  if (opts.contractOnly) return finish(issues);

  const contract = readContract(project);
  const all = sourceFiles(project);
  const registry = readRegistry(project, all);
  const inScope = (file: string) => !targets || targets.includes(file);
  issues.push(...registry.issues.filter((i) => inScope(i.file)));

  const kitIds: KitIdUse[] = [];
  for (const file of all) {
    if (file.endsWith(".css")) {
      if (inScope(file)) issues.push(...checkCssFile(file, readFileSync(project.abs(file), "utf8"), contract));
      continue;
    }
    // Every tsx file is read for its ids so duplicates across a screen's files are caught,
    // but only files in scope report their own problems.
    const isTsx = file.endsWith(".tsx");
    if (!inScope(file) && !isTsx) continue;
    const r = checkTsxFile(parseProjectFile(project, file), { contract, owner: ownerOf(registry.screens, file) });
    kitIds.push(...r.kitIds);
    if (inScope(file)) issues.push(...r.issues);
  }
  issues.push(...duplicateKitIds(kitIds).filter((i) => inScope(i.file)));

  // Flow steps depend on every screen, so check them whenever a screen or flows.ts is in scope.
  if (registry.complete && touches((f) => f === LAYOUT.flowsTs || isScreenFile(f))) {
    const built = buildManifest(registry);
    issues.push(...built.issues);
    if (!registry.issues.some((i) => i.severity === "error") && !built.issues.length) {
      const stale = staleIssue(project, built.manifest);
      if (stale) issues.push(stale);
    }
  }
  return finish(issues);
}

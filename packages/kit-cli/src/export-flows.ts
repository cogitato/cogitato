import { buildManifest, currentCommit, keptStatus, writeManifest, type ExportResult } from "./flows.js";
import { sourceFiles, type Project } from "./project.js";
import { readRegistry } from "./registry.js";

export interface ExportOptions {
  /** Don't write; report whether design/flows.json is up to date. */
  check?: boolean;
}

/** Reads every screen and src/flows.ts, and writes design/flows.json for the canvas. */
export function exportFlows(project: Project, opts: ExportOptions = {}): ExportResult {
  const registry = readRegistry(project, sourceFiles(project));
  const built = buildManifest(registry, currentCommit(project));
  // With an unreadable screen, flow-step problems would only repeat it (see Registry.complete).
  const flowIssues = registry.complete ? built.issues : [];
  // Review statuses are set on the canvas, not in code, so they carry over from the current file.
  const status = keptStatus(project, built.manifest);
  const manifest = status ? { ...built.manifest, status } : built.manifest;
  return writeManifest(project, { manifest, issues: [...registry.issues, ...flowIssues] }, opts.check ?? false);
}

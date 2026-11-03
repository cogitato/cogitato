import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SCHEMA_VERSIONS, validateFlows, type FlowManifest } from "@cogitato/contract";
import type { Issue } from "./issue.js";
import { LAYOUT, type Project } from "./project.js";
import type { FlowEntry, Registry } from "./registry.js";

const FLOWS_SCHEMA = "../node_modules/@cogitato/contract/schema/flows.schema.json";

function unknownStep(reg: Registry, flow: FlowEntry, ref: string, at: { file: string; line: number; column: number }): Issue {
  const dot = ref.lastIndexOf(".");
  const screenId = ref.slice(0, dot);
  const state = ref.slice(dot + 1);
  const screen = reg.screens.find((s) => s.id === screenId);
  const reason = dot < 0
    ? `steps are written as "{screen id}.{state}", like "checkout.payment.default"`
    : screen
      ? `the ${screen.title} screen has no state called "${state}" (it has: ${screen.fixtures.map((f) => `"${f.key}"`).join(", ")})`
      : `there's no screen with the id "${screenId}"`;
  return {
    code: "code-unknown-flow-step",
    severity: "error",
    file: at.file,
    path: "",
    line: at.line,
    column: at.column,
    message: `The "${flow.title}" flow mentions "${ref}", but ${reason}.`,
  };
}

/**
 * Builds flows.json content from the registry. Screens are ordered by their first appearance
 * in a flow (so the canvas reads left to right), then by id.
 */
export function buildManifest(reg: Registry, commit?: string): { manifest: FlowManifest; issues: Issue[] } {
  const issues: Issue[] = [];
  const known = new Set(reg.screens.flatMap((s) => s.fixtures.map((f) => `${s.id}.${f.key}`)));

  const flows = reg.flows.map((flow) => {
    for (const e of flow.edges) {
      if (!known.has(e.from)) issues.push(unknownStep(reg, flow, e.from, e));
      if (!known.has(e.to)) issues.push(unknownStep(reg, flow, e.to, e));
    }
    for (const n of flow.nodes ?? []) if (!known.has(n.ref)) issues.push(unknownStep(reg, flow, n.ref, n.at));
    const nodes = flow.nodes ? flow.nodes.map((n) => n.ref) : [...new Set(flow.edges.flatMap((e) => [e.from, e.to]))];
    return {
      id: flow.id,
      title: flow.title,
      nodes,
      edges: flow.edges.map(({ from, to, label }) => (label !== undefined ? { from, to, label } : { from, to })),
    };
  });

  const order = new Map<string, number>();
  for (const f of flows) for (const node of f.nodes) {
    const screenId = node.slice(0, node.lastIndexOf("."));
    if (!order.has(screenId)) order.set(screenId, order.size);
  }
  const rank = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const screens = [...reg.screens]
    .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      route: s.route,
      title: s.title,
      states: s.fixtures.map((f) => ({ id: f.key, fixture: f.key, title: f.title })),
    }));

  const manifest = {
    $schema: FLOWS_SCHEMA,
    schemaVersion: SCHEMA_VERSIONS.flows,
    ...(commit ? { commit } : {}),
    screens,
    flows,
  } as FlowManifest;
  return { manifest, issues };
}

export function currentCommit(project: Project): string | undefined {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: project.root, encoding: "utf8" });
  const sha = r.status === 0 ? r.stdout.trim() : "";
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : undefined;
}

export const serializeManifest = (m: FlowManifest) => JSON.stringify(m, null, 2) + "\n";

/**
 * Compares manifests ignoring `commit`, which changes on every commit, and review `status`, which
 * is set on the canvas rather than derived from code. Pass `status: true` to compare it too.
 */
export function sameManifest(a: FlowManifest, b: FlowManifest, opts: { status?: boolean } = {}): boolean {
  const strip = ({ commit: _c, status, ...rest }: FlowManifest) =>
    JSON.stringify(opts.status ? { ...rest, status: status ?? {} } : rest);
  return strip(a) === strip(b);
}

/** Review statuses from the current flows.json, for the states that still exist. */
export function keptStatus(project: Project, manifest: FlowManifest): FlowManifest["status"] | undefined {
  const existing = readFlowsJson(project)?.status;
  if (!existing) return undefined;
  const nodes = new Set(manifest.screens.flatMap((s) => s.states.map((st) => `${s.id}.${st.id}`)));
  const kept = Object.fromEntries(Object.entries(existing).filter(([node]) => nodes.has(node)));
  return Object.keys(kept).length ? kept : undefined;
}

export function readFlowsJson(project: Project): FlowManifest | undefined {
  const path = project.abs(LAYOUT.flowsJson);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as FlowManifest;
  } catch {
    return undefined;
  }
}

/** Checks that design/flows.json matches the code. A warning: the next export fixes it. */
export function staleIssue(project: Project, manifest: FlowManifest): Issue | undefined {
  const existing = readFlowsJson(project);
  if (existing && sameManifest(existing, manifest)) return undefined;
  return {
    code: "code-flows-stale",
    severity: "warning",
    file: LAYOUT.flowsJson,
    path: "",
    message: existing
      ? "flows.json is out of date with the screens and flows in the code. Run the flow export to update it."
      : "flows.json hasn't been created yet. Run the flow export to create it.",
  };
}

export interface ExportResult {
  manifest: FlowManifest;
  issues: Issue[];
  /** True when the file on disk differs from the export (ignoring commit). */
  changed: boolean;
  written: boolean;
}

/** Writes design/flows.json, unless there are problems or `check` is set. */
export function writeManifest(project: Project, built: { manifest: FlowManifest; issues: Issue[] }, check: boolean): ExportResult {
  const issues = [...built.issues];
  if (!issues.some((i) => i.severity === "error")) {
    // Safety net: the shared validator must accept what we're about to write.
    const r = validateFlows(built.manifest, LAYOUT.flowsJson);
    issues.push(...r.issues);
  }
  const existing = readFlowsJson(project);
  const changed = !existing || !sameManifest(existing, built.manifest, { status: true });
  const ok = !issues.some((i) => i.severity === "error");
  const written = ok && !check && (changed || existing?.commit !== built.manifest.commit);
  if (written) writeFileSync(project.abs(LAYOUT.flowsJson), serializeManifest(built.manifest));
  return { manifest: built.manifest, issues, changed, written };
}

import { spawnSync } from "node:child_process";
import type { FlowManifest, Issue } from "@cogitato/contract";
import { KitError } from "./errors.js";
import { exportFlows } from "./export-flows.js";
import { sameManifest } from "./flows.js";
import { previewLink } from "./links.js";
import { LAYOUT, WORKSPACE_LAYOUT, type Project } from "./project.js";
import { statusLabel } from "./status.js";
import { validate } from "./validate.js";

// "Save a version" for designers: git, without the git. Commits everything on a design branch
// with a message describing what changed, and pushes when there's somewhere to push to.

export interface SaveOptions {
  /** Replaces the generated first line of the commit message. */
  message?: string;
  /** For tests. */
  now?: Date;
}

export interface SaveResult {
  saved: boolean;
  branch?: string;
  /** Short commit id. */
  commit?: string;
  /** The commit message's first line. */
  summary?: string;
  pushed: boolean;
  /** The branch's hosted canvas, when the prototype has hosting set up and the push worked. */
  preview?: string;
  /** One or two plain sentences for the designer. */
  message: string;
  /** Validation problems at the time of saving. They don't stop the save. */
  issues: Issue[];
}

function git(project: Project, args: string[], raw = false): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", args, { cwd: project.root, encoding: "utf8" });
  return { ok: r.status === 0, out: raw ? (r.stdout ?? "") : (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "designer";

/** What changed between two flows.json versions, as short phrases: "add screen checkout.review". */
export function describeChanges(before: FlowManifest | undefined, after: FlowManifest): string[] {
  const states = (m: FlowManifest | undefined) =>
    new Map((m?.screens ?? []).flatMap((s) => s.states.map((st) => [`${s.id}.${st.id}`, s.id] as const)));
  const screens = (m: FlowManifest | undefined) => new Set((m?.screens ?? []).map((s) => s.id));
  const [s0, s1, st0, st1] = [screens(before), screens(after), states(before), states(after)];
  const out: string[] = [];
  for (const id of s1) if (!s0.has(id)) out.push(`add screen ${id}`);
  for (const [node, screen] of st1) if (!st0.has(node) && s0.has(screen)) out.push(`add state ${node}`);
  for (const id of s0) if (!s1.has(id)) out.push(`remove screen ${id}`);
  for (const [node, screen] of st0) if (!st1.has(node) && s1.has(screen)) out.push(`remove state ${node}`);
  for (const [node, status] of Object.entries(after.status ?? {}) as [`${string}.${string}`, string | undefined][]) {
    if (st1.has(node) && (before?.status as Record<string, string> | undefined)?.[node] !== status) out.push(`mark ${node} ${statusLabel(status ?? "exploring").toLowerCase()}`);
  }
  const edges = (m: FlowManifest | undefined) => new Set((m?.flows ?? []).flatMap((f) => f.edges.map((e) => `${e.from}>${e.to}`)));
  const [e0, e1] = [edges(before), edges(after)];
  const newEdges = [...e1].filter((e) => !e0.has(e)).length;
  if (newEdges && !out.length) out.push(`connect ${newEdges} step${newEdges === 1 ? "" : "s"} in the flow`);
  return out;
}

function summarize(changes: string[], files: string[]): string {
  if (changes.length) {
    const line = changes.join("; ");
    const text = line.length <= 68 ? line : `${changes[0]} and ${changes.length - 1} more change${changes.length === 2 ? "" : "s"}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  const screens = [...new Set(files.map((f) => /^src\/screens\/(.+)\/[^/]+$/.exec(f)?.[1]).filter(Boolean))];
  if (screens.length === 1) return `Update ${screens[0]!.split("/").join(".")}`;
  if (screens.length > 1) return `Update ${screens.length} screens`;
  if (files.some((f) => f.includes(`${WORKSPACE_LAYOUT.contract}/`))) return "Update the design contract";
  return "Update the prototype";
}

/** Saves a version of the prototype: commit on a design branch, then push if there's a remote. */
export function saveVersion(project: Project, opts: SaveOptions = {}): SaveResult {
  if (!git(project, ["rev-parse", "--is-inside-work-tree"]).ok) {
    throw new KitError("This prototype doesn't keep a history yet, so versions can't be saved. Ask a developer to set it up with git.");
  }
  const exported = exportFlows(project);
  const before = git(project, ["show", `HEAD:${LAYOUT.flowsJson}`]);
  let previous: FlowManifest | undefined;
  try {
    previous = before.ok ? (JSON.parse(before.out) as FlowManifest) : undefined;
  } catch {
    previous = undefined;
  }
  const status = git(project, ["status", "--porcelain", "--untracked-files=all"], true);
  const files = status.out
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, "").split(" -> ").pop()!)
    // A flows.json whose only change is the commit it was exported at isn't worth a version.
    .filter((f) => !(f === LAYOUT.flowsJson && previous && sameManifest(previous, exported.manifest, { status: true })));
  const issues = validate(project).issues.filter((i) => i.severity === "error");
  if (!files.length) return { saved: false, pushed: false, message: "Nothing new to save: everything is already saved.", issues };

  const user = git(project, ["config", "user.name"]).out;
  if (!user || !git(project, ["config", "user.email"]).out) {
    throw new KitError("Saving needs your name and email set up once on this computer. Ask Claude to set them (git config user.name and user.email).");
  }

  let branch = git(project, ["rev-parse", "--abbrev-ref", "HEAD"]).out;
  if (branch === "main" || branch === "master" || branch === "HEAD") {
    const d = (opts.now ?? new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const base = `design/${slug(user)}-${d}`;
    branch = base;
    for (let n = 2; git(project, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).ok; n++) branch = `${base}-${n}`;
    const sw = git(project, ["switch", "-c", branch]);
    if (!sw.ok) throw new KitError(`Couldn't start a design branch for your work (${sw.err}).`);
  }

  const changes = describeChanges(previous, exported.manifest);
  const summary = opts.message?.trim() || summarize(changes, files);
  const body = [
    ...(changes.length > 1 ? changes.map((c) => `- ${c}`) : []),
    ...(issues.length ? [`Saved with ${issues.length} validation problem${issues.length === 1 ? "" : "s"} still open.`] : []),
  ].join("\n");

  if (!git(project, ["add", "-A"]).ok) throw new KitError("Couldn't collect your changes to save them.");
  const commit = git(project, ["commit", "-q", "-m", summary, ...(body ? ["-m", body] : [])]);
  if (!commit.ok) throw new KitError(`Couldn't save the version (${commit.err || commit.out}).`);
  const sha = git(project, ["rev-parse", "--short", "HEAD"]).out;

  const remote = git(project, ["remote"]).out.split("\n").filter(Boolean)[0];
  let pushed = false;
  let where = "Saved on this computer (there's no shared copy to send it to yet).";
  if (remote) {
    const push = git(project, ["push", "-u", remote, branch]);
    pushed = push.ok;
    where = push.ok
      ? `Saved and shared on the "${branch}" branch.`
      : `Saved on this computer, but sharing it failed (${push.err.split("\n")[0]}). Try saving again later.`;
  }
  const preview = pushed ? previewLink(project, branch) : undefined;
  if (preview) where += ` Your preview will be at ${preview} in a minute or two.`;
  const problems = issues.length ? ` Heads up: ${issues.length} validation problem${issues.length === 1 ? " is" : "s are"} still open.` : "";
  return { saved: true, branch, commit: sha, summary, pushed, ...(preview ? { preview } : {}), message: `${where} Version: "${summary}".${problems}`, issues };
}

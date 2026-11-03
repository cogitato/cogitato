import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { kebabCase, validateFormat, type Gap, type GapLog } from "@cogitato/contract";
import { KitError } from "./errors.js";
import { LAYOUT, type Project } from "./project.js";

const FILE = `${LAYOUT.contract}/gaps.json`;
const SCHEMA = "../../node_modules/@cogitato/contract/schema/gaps.schema.json";

export interface AddGapOptions {
  kind: Gap["kind"];
  /** What's missing, e.g. "Stepper" or "color.feedback.warning-subtle". */
  name: string;
  /** What the designer was trying to do. */
  context: string;
  screen?: string;
  workaround?: string;
  requestedBy?: string;
  /** For tests. */
  now?: Date;
}

export interface AddGapResult {
  gap: Gap;
  /** False when the same open gap was already logged; it's returned instead of a duplicate. */
  created: boolean;
}

function gitUser(project: Project): string | undefined {
  const r = spawnSync("git", ["config", "user.name"], { cwd: project.root, encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : undefined;
}

/** Records something the design needed that the contract doesn't have, in design/contract/gaps.json. */
export function addGap(project: Project, opts: AddGapOptions): AddGapResult {
  const path = project.abs(FILE);
  let log: GapLog = { $schema: SCHEMA, gaps: [] };
  if (existsSync(path)) {
    try {
      log = JSON.parse(readFileSync(path, "utf8")) as GapLog;
    } catch {
      throw new KitError(`${FILE} has a typo in it, so the gap couldn't be added. Ask a developer to fix the file.`);
    }
  }

  const name = opts.name.trim();
  const same = log.gaps.find((g) => g.status === "open" && g.kind === opts.kind && g.name.toLowerCase() === name.toLowerCase());
  if (same) return { gap: same, created: false };

  const slug = kebabCase(name).replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  const taken = new Set(log.gaps.map((g) => g.id));
  let id = `gap_${slug}`;
  for (let n = 2; taken.has(id); n++) id = `gap_${slug}-${n}`;

  const requestedBy = opts.requestedBy ?? gitUser(project);
  const gap: Gap = {
    id,
    kind: opts.kind,
    name,
    context: opts.context.trim(),
    ...(opts.screen ? { screen: opts.screen } : {}),
    ...(opts.workaround?.trim() ? { workaround: opts.workaround.trim() } : {}),
    ...(requestedBy ? { requestedBy } : {}),
    status: "open",
    createdAt: (opts.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  const next: GapLog = { ...log, gaps: [...log.gaps, gap] };
  const check = validateFormat("gaps", next, FILE);
  if (!check.ok) throw new KitError(`The gap couldn't be recorded: ${check.issues.map((i) => i.message).join(" ")}`);
  writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
  return { gap, created: true };
}

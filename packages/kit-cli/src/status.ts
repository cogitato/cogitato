import { readSchema, type FlowManifest } from "@cogitato/contract";
import { KitError } from "./errors.js";
import { exportFlows } from "./export-flows.js";
import { readFlowsJson, writeManifest } from "./flows.js";
import type { Project } from "./project.js";

// Review status of each frame on the canvas, kept in flows.json's `status` (ADR 014).

const common = readSchema("common.schema.json") as { $defs: { frameStatus: { enum: string[] } } };
/** exploring, in-review, approved, handed-off: from the shared schema. */
export type FrameStatusValue = "exploring" | "in-review" | "approved" | "handed-off";
export const FRAME_STATUSES = common.$defs.frameStatus.enum as FrameStatusValue[];

const LABELS: Record<string, string> = { exploring: "Exploring", "in-review": "In review", approved: "Approved", "handed-off": "Handed off" };

/**
 * Sets a state's review status. "exploring" is the default, so it removes the entry.
 * Returns the state's previous status.
 */
export function setStatus(project: Project, node: string, status: string): { node: string; status: FrameStatusValue; previous: FrameStatusValue } {
  if (!FRAME_STATUSES.includes(status as FrameStatusValue)) {
    throw new KitError(`"${status}" isn't a review status. Use one of: ${FRAME_STATUSES.map((s) => `${s} (${LABELS[s] ?? s})`).join(", ")}.`);
  }
  // Start from a fresh export so the status lands on what the code has right now.
  const exported = exportFlows(project);
  if (exported.issues.some((i) => i.severity === "error")) {
    throw new KitError("The flow map can't be updated until the prototype's problems are fixed. Check the prototype first.");
  }
  const manifest = readFlowsJson(project) ?? exported.manifest;
  const known = manifest.screens.flatMap((s) => s.states.map((st) => `${s.id}.${st.id}`));
  if (!known.includes(node)) throw new KitError(`There's no screen state called "${node}". States look like "checkout.payment.card-declined".`);

  const current = (manifest.status ?? {}) as Record<string, FrameStatusValue>;
  const previous = current[node] ?? "exploring";
  const { [node]: _old, ...others } = current;
  const statuses = status === "exploring" ? others : { ...others, [node]: status as FrameStatusValue };
  const { status: _s, ...rest } = manifest;
  const next = (Object.keys(statuses).length ? { ...rest, status: statuses } : rest) as FlowManifest;
  const r = writeManifest(project, { manifest: next, issues: [] }, false);
  if (r.issues.some((i) => i.severity === "error")) throw new KitError(`The status couldn't be saved: ${r.issues[0]!.message}`);
  return { node, status: status as FrameStatusValue, previous };
}

export const statusLabel = (status: string) => LABELS[status] ?? status;

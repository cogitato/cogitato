import { dirname, isAbsolute } from "node:path";
import { machineChecks, prototypeChecks, type DoctorOptions } from "./doctor.js";
import { exportFlows } from "./export-flows.js";
import { formatResult } from "./format.js";
import {
  LAYOUT,
  WORKSPACE_LAYOUT,
  findProject,
  findWorkspace,
  isScreenFile,
  listPrototypes,
  projectIn,
  sourceFiles,
  type Project,
  type Workspace,
} from "./project.js";
import { readRegistry } from "./registry.js";
import { validate } from "./validate.js";
import { validateWorkspace } from "./workspace.js";

// Claude Code hooks for the Cogitato plugin. The plugin's launcher pipes the hook's JSON input
// to `kit hook <event>` and passes the JSON printed here back to Claude Code. Fields follow the
// Claude Code hooks reference (checked 2026-11-02).

export type HookEvent = "post-edit" | "session-start";

export interface HookInput {
  hook_event_name?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: { file_path?: string };
  source?: string;
}

export interface HookOutput {
  decision?: "block";
  reason?: string;
  systemMessage?: string;
  hookSpecificOutput?: { hookEventName: "PostToolUse" | "SessionStart"; additionalContext?: string };
}

export const MCP_TOOLS =
  "list_components, get_component, get_tokens, list_prototypes, create_screen, add_state, log_gap, validate, canvas_link, set_status";

const FIX_ADVICE =
  "Fix these before finishing. If the design needs something the kit doesn't have, use the nearest token or kit component " +
  "and say so, or log a gap with the log_gap tool; don't hardcode values or build your own components.";

/** Which files the edit hook checks: prototype source and the design/ folder. */
export function checkedByHook(rel: string): boolean {
  if (rel.startsWith("..") || isAbsolute(rel)) return false;
  if (rel.startsWith(`${LAYOUT.design}/`)) return rel.endsWith(".json") || rel.endsWith(".md");
  return rel.startsWith(`${LAYOUT.src}/`) && /\.(tsx?|css)$/.test(rel) && !rel.endsWith(".d.ts");
}

/** After Claude writes or edits a file: keep flows.json fresh and send any problems back to Claude. */
export function postEditHook(project: Project, input: HookInput): HookOutput | undefined {
  const file = input.tool_input?.file_path;
  if (!file) return undefined;
  const rel = project.rel(file);
  if (!checkedByHook(rel)) return undefined;
  const shown = `${WORKSPACE_LAYOUT.prototypes}/${project.name}/${rel}`;

  if (rel === LAYOUT.flowsJson) {
    return {
      decision: "block",
      reason:
        "design/flows.json is generated from the screens and src/flows.ts, so edits to it get overwritten. " +
        "Change src/flows.ts (or the screen's states) instead; the file updates itself after each edit.",
    };
  }
  if (isScreenFile(rel) || rel === LAYOUT.flowsTs) exportFlows(project);

  const r = validate(project, { files: [rel] });
  if (r.ok && r.issues.length === 0) return undefined;
  if (r.ok) {
    return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `Cogitato check of ${shown}:\n${formatResult(r)}` } };
  }
  return { decision: "block", reason: `Cogitato check of ${shown}: ${formatResult(r)}\n\n${FIX_ADVICE}` };
}

/** After an edit to the shared design contract: check the contract, and report problems in it. */
function contractEditHook(ws: Workspace, rel: string): HookOutput | undefined {
  const own = validateWorkspace(ws, { contractOnly: true }).issues;
  if (!own.length) return undefined;
  const result = { ok: !own.some((i) => i.severity === "error"), issues: own };
  return result.ok
    ? { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `Cogitato check of ${rel}:\n${formatResult(result)}` } }
    : { decision: "block", reason: `Cogitato check of ${rel}: ${formatResult(result)}\n\n${FIX_ADVICE}` };
}

/** At session start: tell the designer (one line) and Claude (details) if the machine isn't ready. */
export async function sessionStartHook(ws: Workspace, opts: DoctorOptions = {}): Promise<HookOutput> {
  const names = listPrototypes(ws);
  // Machine-wide checks run once; the rest once per prototype.
  const checks = [...(await machineChecks(opts)), ...names.flatMap((n) => prototypeChecks(projectIn(ws, n)))];
  const unique = (status: string) => {
    const seen = new Set<string>();
    return checks.filter((c) => c.status === status && !seen.has(c.message) && seen.add(c.message));
  };
  const problems = unique("problem");
  const warnings = unique("warning");

  const parts = names.map((name) => {
    const p = projectIn(ws, name);
    const reg = readRegistry(p, sourceFiles(p));
    const states = reg.screens.reduce((n, s) => n + s.fixtures.length, 0);
    return `${name} (${reg.screens.length} screen${reg.screens.length === 1 ? "" : "s"}, ${states} state${states === 1 ? "" : "s"})`;
  });
  const first =
    (parts.length
      ? `This is a Cogitato design workspace with ${parts.length} prototype${parts.length === 1 ? "" : "s"}: ${parts.join(", ")}. `
      : "This is a Cogitato design workspace with no prototypes yet. ") +
    "The design kit (design/contract and kit/) is shared by all of them; each prototype is a folder in prototypes/. " +
    "When the person doesn't say which prototype they mean and there's more than one, ask.";

  const context = [
    first,
    "The person here is usually a designer: plain language, never ask them to run commands.",
    `Use the Cogitato MCP tools (${MCP_TOOLS}) instead of reading design/contract files, and the Cogitato skills for building screens and states.`,
    "Every edit is checked automatically and design/flows.json is regenerated after each one, so there's no need to run kit commands yourself.",
    ...(problems.length
      ? ["", "Setup problems found:", ...problems.map((c) => `- ${c.message}`), "Offer to fix them with the Cogitato setup-machine skill, in plain words."]
      : []),
    ...(warnings.length ? ["", "Notes:", ...warnings.map((c) => `- ${c.message}`)] : []),
  ].join("\n");

  return {
    ...(problems.length
      ? { systemMessage: `Cogitato: this design workspace isn't ready on this computer yet. ${problems[0]!.message} Ask Claude to set it up.` }
      : {}),
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  };
}

/**
 * Runs a hook from its JSON input. Returns undefined when there's nothing to say (including
 * when the session isn't in a Cogitato workspace at all).
 */
export async function runHook(event: HookEvent, input: HookInput, start = input.cwd ?? process.cwd()): Promise<HookOutput | undefined> {
  const ws = findWorkspace(start);
  if (!ws) return undefined;
  if (event === "session-start") return sessionStartHook(ws);
  const file = input.tool_input?.file_path;
  if (!file) return undefined;
  const rel = ws.rel(file);
  if (rel.startsWith(`${WORKSPACE_LAYOUT.contract}/`) && /\.(json|md)$/.test(rel)) return contractEditHook(ws, rel);
  const project = findProject(dirname(ws.abs(rel)));
  return project && project.workspace.root === ws.root ? postEditHook(project, input) : undefined;
}

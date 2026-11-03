import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_PORT } from "./doctor.js";
import { KitError } from "./errors.js";
import { sourceFiles, type Project } from "./project.js";
import { readRegistry, type ScreenEntry } from "./registry.js";

export const CANVAS_PATH = "/__canvas";

/** Finds the screen and state for "{screen id}.{state}" or a bare screen id (its default state). */
function resolveNode(project: Project, node: string): { screen: ScreenEntry; state: string } {
  const { screens } = readRegistry(project, sourceFiles(project));
  let screen = screens.find((s) => s.id === node);
  let state = "default";
  if (!screen) {
    const dot = node.lastIndexOf(".");
    screen = screens.find((s) => s.id === node.slice(0, dot));
    state = node.slice(dot + 1);
  }
  if (!screen) throw new KitError(`There's no screen or state called "${node}".`);
  if (!screen.fixtures.some((f) => f.key === state)) {
    throw new KitError(`The ${screen.title} screen has no state called "${state}".`);
  }
  return { screen, state };
}

/**
 * Local address of a screen state, like http://localhost:5173/checkout/payment?fixture=card-declined.
 * `node` is "{screen id}.{state}" or just a screen id (its default state).
 */
export function stateLink(project: Project, node: string, port = DEFAULT_PORT): string {
  const { screen, state } = resolveNode(project, node);
  return `http://localhost:${port}${screen.route}?fixture=${encodeURIComponent(state)}`;
}

/** Local canvas, opened on one state's frame. */
export function canvasLink(project: Project, node: string, port = DEFAULT_PORT): string {
  const { screen, state } = resolveNode(project, node);
  return `http://localhost:${port}${CANVAS_PATH}?focus=${encodeURIComponent(`${screen.id}.${state}`)}`;
}

/** Netlify's form of a branch name in branch-deploy addresses: "design/sam-0102" -> "design-sam-0102". */
export function branchSlug(branch: string): string {
  return branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Hosted canvas for a branch, from `"kit": { "previewUrl": "https://{branch}--site.netlify.app" }`
 * in the prototype's package.json. Undefined when the prototype has no hosting set up.
 */
export function previewLink(project: Project, branch: string, node?: string): string | undefined {
  const pkgPath = project.abs("package.json");
  if (!existsSync(pkgPath)) return undefined;
  let template: unknown;
  try {
    template = (JSON.parse(readFileSync(pkgPath, "utf8")) as { kit?: { previewUrl?: unknown } }).kit?.previewUrl;
  } catch {
    return undefined;
  }
  if (typeof template !== "string" || !template.includes("{branch}")) return undefined;
  const base = template.replace("{branch}", branchSlug(branch)).replace(/\/+$/, "");
  return `${base}${CANVAS_PATH}${node ? `?focus=${encodeURIComponent(node)}` : ""}`;
}

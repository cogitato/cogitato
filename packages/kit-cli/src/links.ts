import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_PORT } from "./doctor.js";
import { KitError } from "./errors.js";
import { previewHost, slugPart } from "./hosting.js";
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

/**
 * Hosted canvas for a branch, from the workspace's package.json:
 * `"kit": { "previewUrl": "https://{host}.cogitato-preview.app", "org": "acme-shop-demo" }`.
 * `{host}` is previewHost(branch, prototype, org). Undefined when hosting isn't set up.
 */
export function previewLink(project: Project, branch: string, node?: string): string | undefined {
  const pkgPath = project.workspace.abs("package.json");
  if (!existsSync(pkgPath)) return undefined;
  let kit: { previewUrl?: unknown; org?: unknown } | undefined;
  try {
    kit = (JSON.parse(readFileSync(pkgPath, "utf8")) as { kit?: typeof kit }).kit;
  } catch {
    return undefined;
  }
  if (typeof kit?.previewUrl !== "string" || !kit.previewUrl.includes("{host}") || typeof kit.org !== "string" || !slugPart(kit.org)) return undefined;
  const host = previewHost({ branch, prototype: project.name, org: kit.org });
  const base = kit.previewUrl.replace("{host}", host).replace(/\/+$/, "");
  return `${base}${CANVAS_PATH}${node ? `?focus=${encodeURIComponent(node)}` : ""}`;
}

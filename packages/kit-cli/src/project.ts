import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  resolveTokens,
  tokensToCss,
  type ComponentManifest,
  type DesignTokens,
  type ResolvedToken,
} from "@cogitato/contract";
import { KitError } from "./errors.js";

/** Workspace conventions: one design kit for every prototype (no config file). */
export const WORKSPACE_LAYOUT = {
  contract: "design/contract",
  kit: "kit",
  prototypes: "prototypes",
} as const;

/** Conventions inside one prototype, prototypes/<name>/. */
export const LAYOUT = {
  design: "design",
  flowsJson: "design/flows.json",
  src: "src",
  screens: "src/screens",
  flowsTs: "src/flows.ts",
  screenFile: "screen.tsx",
} as const;

/** A folder with paths relative to it. */
export interface Workspace {
  /** Absolute path of the folder. */
  root: string;
  /** Absolute path for a relative path. */
  abs(rel: string): string;
  /** Relative path with "/" separators. */
  rel(abs: string): string;
}

/** One prototype. Its paths are relative to prototypes/<name>/. */
export interface Project extends Workspace {
  name: string;
  workspace: Workspace;
}

export function workspaceAt(root: string): Workspace {
  return {
    root,
    abs: (rel) => (isAbsolute(rel) ? rel : join(root, rel)),
    rel: (abs) => relative(root, isAbsolute(abs) ? abs : join(root, abs)).split(sep).join("/"),
  };
}

/** Finds the workspace by walking up from `from` to the first folder containing design/contract. */
export function findWorkspace(from: string = process.cwd()): Workspace | undefined {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, WORKSPACE_LAYOUT.contract))) return workspaceAt(dir);
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Names of the prototypes in a workspace: folders in prototypes/ with a package.json. Sorted. */
export function listPrototypes(ws: Workspace): string[] {
  const dir = ws.abs(WORKSPACE_LAYOUT.prototypes);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && existsSync(join(dir, name, "package.json")))
    .sort();
}

export function projectIn(ws: Workspace, name: string): Project {
  if (!listPrototypes(ws).includes(name)) {
    const names = listPrototypes(ws);
    throw new KitError(`There's no prototype called "${name}".${names.length ? ` The prototypes here are: ${names.join(", ")}.` : ""}`);
  }
  return { ...workspaceAt(ws.abs(`${WORKSPACE_LAYOUT.prototypes}/${name}`)), name, workspace: ws };
}

/** The prototype whose folder is `root` (prototypes/<name>). */
export function projectAt(root: string): Project {
  const ws = findWorkspace(root);
  if (!ws) throw new KitError(`${root} isn't inside a Cogitato workspace (there's no design/contract folder above it).`);
  const name = basename(resolve(root));
  if (resolve(root) !== resolve(ws.abs(`${WORKSPACE_LAYOUT.prototypes}/${name}`))) {
    throw new KitError(`${root} isn't a prototype folder. Prototypes live in ${WORKSPACE_LAYOUT.prototypes}/<name> inside the workspace.`);
  }
  return projectIn(ws, name);
}

/** The prototype `from` is inside, or the workspace's only prototype. Undefined if it's unclear. */
export function findProject(from: string = process.cwd()): Project | undefined {
  const ws = findWorkspace(from);
  if (!ws) return undefined;
  const name = new RegExp(`^${WORKSPACE_LAYOUT.prototypes}/([^/]+)`).exec(ws.rel(resolve(from)))?.[1];
  const all = listPrototypes(ws);
  if (name && all.includes(name)) return projectIn(ws, name);
  return all.length === 1 ? projectIn(ws, all[0]!) : undefined;
}

/** The named prototype, else the one `from` is in, else the only one. Throws a designer-readable error otherwise. */
export function resolvePrototype(ws: Workspace, name?: string, from?: string): Project {
  if (name) return projectIn(ws, name);
  const found = findProject(from ?? ws.root);
  if (found && found.workspace.root === ws.root) return found;
  const all = listPrototypes(ws);
  if (!all.length) throw new KitError("This workspace has no prototypes yet. Ask Claude to start one.");
  throw new KitError(`This workspace has several prototypes (${all.join(", ")}). Say which one.`);
}

const SOURCE = /\.(tsx?|css)$/;

/** Every .ts, .tsx and .css file under src/, project-relative, sorted. */
export function sourceFiles(project: Project): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (SOURCE.test(name) && !name.endsWith(".d.ts")) out.push(project.rel(path));
    }
  };
  walk(project.abs(LAYOUT.src));
  return out.sort();
}

export const isScreenFile = (rel: string) => rel.startsWith(`${LAYOUT.screens}/`) && rel.endsWith(`/${LAYOUT.screenFile}`);

/** What the code rules need from the contract. Read leniently: contract problems are reported by contract validation. */
export interface ContractView {
  tokens: ResolvedToken[];
  /** Every CSS custom property the runtime defines, taken from the generated token CSS itself. */
  cssVars: Set<string>;
  manifests: Map<string, ComponentManifest>;
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function readContract(from: Workspace | Project): ContractView {
  const ws = "workspace" in from ? from.workspace : from;
  const tokensJson = readJson<DesignTokens>(ws.abs(`${WORKSPACE_LAYOUT.contract}/tokens.json`));
  let tokens: ResolvedToken[] = [];
  let cssVars = new Set<string>();
  try {
    if (tokensJson) {
      tokens = resolveTokens(tokensJson);
      cssVars = new Set(tokensToCss(tokensJson).match(/--kit-[A-Za-z0-9_-]+(?=:)/g) ?? []);
    }
  } catch {
    tokens = [];
  }
  const manifests = new Map<string, ComponentManifest>();
  const dir = ws.abs(`${WORKSPACE_LAYOUT.contract}/components`);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const m = readJson<ComponentManifest>(join(dir, f));
      if (m && typeof m.name === "string") manifests.set(m.name, m);
    }
  }
  return { tokens, cssVars, manifests };
}

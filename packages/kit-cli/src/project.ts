import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  resolveTokens,
  tokensToCss,
  type ComponentManifest,
  type DesignTokens,
  type ResolvedToken,
} from "@cogitato/contract";

/** Folder and file conventions every Cogitato prototype follows (no config file in v1). */
export const LAYOUT = {
  design: "design",
  contract: "design/contract",
  flowsJson: "design/flows.json",
  src: "src",
  screens: "src/screens",
  kit: "src/kit",
  flowsTs: "src/flows.ts",
  screenFile: "screen.tsx",
} as const;

export interface Project {
  /** Absolute path of the prototype root (the folder holding design/ and src/). */
  root: string;
  /** Absolute path for a project-relative path. */
  abs(rel: string): string;
  /** Project-relative path with "/" separators. */
  rel(abs: string): string;
}

/** Finds the prototype root by walking up from `from` to the first folder containing design/contract. */
export function findProject(from: string = process.cwd()): Project | undefined {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, LAYOUT.contract))) return projectAt(dir);
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function projectAt(root: string): Project {
  return {
    root,
    abs: (rel) => (isAbsolute(rel) ? rel : join(root, rel)),
    rel: (abs) => relative(root, isAbsolute(abs) ? abs : join(root, abs)).split(sep).join("/"),
  };
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
export const isKitFile = (rel: string) => rel.startsWith(`${LAYOUT.kit}/`);

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

export function readContract(project: Project): ContractView {
  const tokensJson = readJson<DesignTokens>(project.abs(`${LAYOUT.contract}/tokens.json`));
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
  const dir = project.abs(`${LAYOUT.contract}/components`);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const m = readJson<ComponentManifest>(join(dir, f));
      if (m && typeof m.name === "string") manifests.set(m.name, m);
    }
  }
  return { tokens, cssVars, manifests };
}

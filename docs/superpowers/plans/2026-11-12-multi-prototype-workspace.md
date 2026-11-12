# Multi-prototype workspace implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cogitato repo becomes one workspace per org, holding a shared design kit and a folder per prototype. This ships as 0.2.0, the first step of Phase 3 in the hosted previews design.

**Architecture:** `kit-cli` learns two roots.
- The **workspace** holds `design/contract/`, the coded kit in `kit/`, the lockfile and `prototypes/`.
- A **prototype** is `prototypes/<name>/`, with `src/`, `design/flows.json` and its own `package.json`.

Everything that works on one prototype keeps taking a `Project`, which now carries its `workspace`. Commands that span prototypes (validate everything, save, the session hook) take the `Workspace`. Two pure functions for the platform, `previewHost` and `affectedPrototypes`, ship as `@cogitato/kit-cli/hosting`.

**Tech stack:** TypeScript, pnpm 11 workspaces, vitest, Vite 6, Changesets 3.

**Spec:** `cogitato-platform/docs/superpowers/specs/2026-11-03-hosted-previews-design.md`, section "Repo layout".

## Plans that follow this one (written when their turn comes)
1. **This plan:** the multi-prototype workspace in the open packages, released as 0.2.0.
2. **Platform foundation** (`cogitato-platform`):
   - SST stages, Neon and the data model;
   - accounts, sign-in, invites and orgs;
   - the GitHub App install flow.
3. **Builds:**
   - the builder image;
   - the CodeBuild install and build steps, including the no-NAT VPC spike first;
   - the worker, the output check, publishing, and the hostile-repo tests.
4. **Previews:**
   - the preview domain and CloudFront;
   - the edge function and KVS, tokens, the `/__kit-auth` flow;
   - the exit test against `acme-shop-demo/acme-design`.

## Global constraints
- **Deterministic logic lives in `packages/kit-cli`.** Skills, hooks, the MCP server and the platform call into it (CLAUDE.md).
- **Every message from the validator, hooks or skills must be understandable by a non-technical designer** (CLAUDE.md).
- **Internal names stay brand-free:** `design/`, `--kit-`, `kit:`, `/__kit-data/` (ADR 016).
- **Schemas are JSON Schema, with types generated from them.**
  - No schema changes in this plan.
  - The `flows.json` `schemaVersion` stays 1.
- **One layout only.** The single-prototype layout of 0.1.0 is not supported after this change.
- **Workspace layout,** copied from the spec plus the shared kit:
  - `design/contract/` at the workspace root;
  - `kit/` at the workspace root (the coded components, imported as `@/kit/...`);
  - `prototypes/<name>/` with `package.json`, `design/flows.json` and `src/`.
- **Inputs that affect every prototype:**
  - `design/**` at the root;
  - `kit/**`;
  - the root `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- **Preview host:**
  - the form is `<branch>--<prototype>--<org>`, as one DNS label;
  - over 63 characters it is truncated and given a 6-character hash;
  - the plugin's links and the platform both use `previewHost`.
- **Every change that should reach npm needs a changeset:** a minor bump, 0.2.0.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Public pushes use the noreply author.

## File map
| File | Change |
|---|---|
| `packages/contract/src/validate.ts` | `validateProject(designDir, contractDir?)` |
| `packages/kit-cli/src/hosting.ts` | **new:** `previewHost`, `affectedPrototypes`, `SHARED_INPUTS` |
| `packages/kit-cli/src/project.ts` | `Workspace`, `WORKSPACE_LAYOUT`, `findWorkspace`, `listPrototypes`, `projectIn`, `resolvePrototype`; `Project.workspace`; contract and kit read from the workspace |
| `packages/kit-cli/src/workspace.ts` | **new:** `validateWorkspace`, `createPrototype` (`kit new-prototype`) |
| `packages/kit-cli/src/{validate,doctor,gaps,hook,save,links,cli,index}.ts`, `rules/tsx.ts` | Adapt to the two roots |
| `packages/kit-mcp/src/{index,server}.ts` | A server per workspace; an optional `prototype` argument on tools; `list_prototypes` |
| `packages/runtime/src/vite.ts` | Contract and kit from the workspace; `@/kit` alias; react dedupe |
| `templates/prototype-react/` → `templates/workspace-react/` | Restructured into the workspace layout |
| `pnpm-workspace.yaml`, `package.json`, `.github/workflows/ci.yml`, `.claude/launch.json`, `netlify.toml` | Point at the new template; remove the root `netlify.toml` |
| `packages/create-cogitato/{src/create.ts,scripts/bundle-template.mjs,test/create.test.ts}` | Create a workspace |
| `plugin/skills/{new-prototype,save-version}/SKILL.md`, `plugin/.claude-plugin/plugin.json` | A folder, not a repo; several preview links; plugin 0.4.0 |
| `docs/decisions/017-multi-prototype-workspace.md`, `docs/architecture/interfaces.md`, `docs/roadmap.md`, `README.md` | Docs |

---

### Task 1: Contract validation with a separate contract folder

**Files:**
- Modify: `packages/contract/src/validate.ts:411-419`
- Test: `packages/contract/test/validate-project.test.ts` (create)

**Interfaces:**
- Produces: `validateProject(designDir: string, contractDir?: string): ValidationResult`. `contractDir` defaults to `join(designDir, "contract")`. Issue `file` labels keep the `contract/...` prefix.

- [ ] **Step 1: Write the failing test**

```ts
// packages/contract/test/validate-project.test.ts
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { validateProject } from "../src/index.js";

const reference = fileURLToPath(new URL("../fixtures/reference/design", import.meta.url));
let dir: string | undefined;
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

it("reads the contract from a separate folder when given one", () => {
  dir = mkdtempSync(join(tmpdir(), "contract-split-"));
  cpSync(join(reference, "contract"), join(dir, "shared-contract"), { recursive: true });
  cpSync(join(reference, "flows.json"), join(dir, "proto", "flows.json"));
  const r = validateProject(join(dir, "proto"), join(dir, "shared-contract"));
  expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
});

it("still finds the contract inside the design folder by default", () => {
  expect(validateProject(reference).ok).toBe(true);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @cogitato/contract exec vitest run test/validate-project.test.ts`
Expected: the first test FAILS with a `file-missing` issue for `contract/`.

- [ ] **Step 3: Implement**

In `packages/contract/src/validate.ts`, change the start of `validateProject`:

```ts
/**
 * Validates a prototype's design folder. `contractDir` is the design contract; in a workspace
 * it's shared by every prototype (design/contract at the workspace root).
 */
export function validateProject(designDir: string, contractDir: string = join(designDir, "contract")): ValidationResult {
  const issues: Issue[] = [];

  if (!existsSync(contractDir)) {
```

Delete the old `const contractDir = join(designDir, "contract");` line. The rest of the function is unchanged.

- [ ] **Step 4: Run the package's tests**

Run: `pnpm --filter @cogitato/contract test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contract
git commit -m "contract: validate a design folder against a shared contract" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `previewHost` and `affectedPrototypes`

**Files:**
- Create: `packages/kit-cli/src/hosting.ts`
- Modify: `packages/kit-cli/package.json` (`exports` gets `"./hosting"`), `packages/kit-cli/src/index.ts`
- Test: `packages/kit-cli/test/hosting.test.ts`

**Interfaces:**
- Produces:
  - `previewHost(parts: { branch: string; prototype: string; org: string }): string`
  - `affectedPrototypes(changedPaths: string[], prototypes: string[]): string[]`
  - `SHARED_INPUTS: readonly string[]`
  - `slugPart(s: string): string`
- Import path: `@cogitato/kit-cli/hosting`. The platform imports this subpath, which has no other kit-cli dependencies.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/kit-cli/test/hosting.test.ts
import { describe, expect, it } from "vitest";
import { affectedPrototypes, previewHost } from "../src/hosting.js";

describe("previewHost", () => {
  it("joins branch, prototype and org with double dashes", () => {
    expect(previewHost({ branch: "design/sam-0102", prototype: "checkout", org: "acme-shop-demo" })).toBe(
      "design-sam-0102--checkout--acme-shop-demo",
    );
  });

  it("slugs each part so double dashes only ever separate parts", () => {
    expect(previewHost({ branch: "Feature//New  Flow", prototype: "Check_Out", org: "Acme--Shop" })).toBe(
      "feature-new-flow--check-out--acme-shop",
    );
  });

  it("is deterministic and fits a DNS label when shortened", () => {
    const parts = { branch: `design/${"very-long-branch-name-".repeat(5)}`, prototype: "checkout", org: "acme-shop-demo" };
    const host = previewHost(parts);
    expect(host).toBe(previewHost(parts));
    expect(host.length).toBeLessThanOrEqual(63);
    expect(host).toMatch(/^[a-z0-9-]+--checkout--acme-shop-demo$/);
    expect(host).toMatch(/-[0-9a-f]{6}--checkout--/);
  });

  it("gives different hosts to long branches that share a prefix", () => {
    const long = "design/" + "x".repeat(80);
    const a = previewHost({ branch: `${long}-a`, prototype: "checkout", org: "acme" });
    const b = previewHost({ branch: `${long}-b`, prototype: "checkout", org: "acme" });
    expect(a).not.toBe(b);
  });

  it("shortens the whole label when prototype and org alone are too long", () => {
    const host = previewHost({ branch: "main", prototype: "p".repeat(40), org: "o".repeat(40) });
    expect(host.length).toBeLessThanOrEqual(63);
    expect(host).toMatch(/^[a-z0-9-]+-[0-9a-f]{6}$/);
    expect(host).not.toMatch(/^-|-$/);
  });
});

describe("affectedPrototypes", () => {
  const all = ["checkout", "onboarding"];
  it.each([
    [["prototypes/checkout/src/screens/cart/screen.tsx"], ["checkout"]],
    [["prototypes/onboarding/design/flows.json", "prototypes/checkout/package.json"], ["checkout", "onboarding"]],
    [["design/contract/tokens.json"], all],
    [["kit/Button.tsx"], all],
    [["package.json"], all],
    [["pnpm-lock.yaml"], all],
    [["pnpm-workspace.yaml"], all],
    [["README.md", ".claude/settings.json", ".github/workflows/x.yml"], []],
    [["prototypes/removed/src/a.tsx"], []],
    [[], []],
  ])("%j affects %j", (paths, expected) => {
    expect(affectedPrototypes(paths, all)).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @cogitato/kit-cli exec vitest run test/hosting.test.ts`
Expected: FAIL, because `../src/hosting.js` doesn't exist.

- [ ] **Step 3: Implement**

```ts
// packages/kit-cli/src/hosting.ts
import { createHash } from "node:crypto";

// Shared with the hosted platform (@cogitato/kit-cli/hosting): the plugin prints preview links
// and the platform serves previews, so both must name hosts and pick prototypes the same way.

/** Paths that every prototype in a workspace depends on: a change here rebuilds them all. */
export const SHARED_INPUTS = ["design/", "kit/", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"] as const;

const MAX_LABEL = 63;
const HASH = 6;

/** One part of a host name: lowercase letters, digits and single dashes. */
export function slugPart(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, HASH);
const cut = (s: string, n: number) => s.slice(0, Math.max(0, n)).replace(/-+$/, "");

/**
 * The DNS label of a branch preview: "<branch>--<prototype>--<org>". A label longer than 63
 * characters keeps the prototype and org, and shortens the branch with a hash of the full label.
 * If even that doesn't fit, the whole label is shortened.
 */
export function previewHost(parts: { branch: string; prototype: string; org: string }): string {
  const branch = slugPart(parts.branch);
  const tail = `--${slugPart(parts.prototype)}--${slugPart(parts.org)}`;
  const full = `${branch}${tail}`;
  if (full.length <= MAX_LABEL) return full;
  const h = hash(full);
  const room = MAX_LABEL - tail.length - HASH - 1;
  if (room >= 1 && cut(branch, room)) return `${cut(branch, room)}-${h}${tail}`;
  return `${cut(full, MAX_LABEL - HASH - 1)}-${h}`;
}

/** Which prototypes a set of changed (workspace-relative) paths affects, sorted. */
export function affectedPrototypes(changedPaths: string[], prototypes: string[]): string[] {
  const known = new Set(prototypes);
  const out = new Set<string>();
  for (const path of changedPaths) {
    if (SHARED_INPUTS.some((s) => (s.endsWith("/") ? path.startsWith(s) : path === s))) return [...known].sort();
    const name = /^prototypes\/([^/]+)\//.exec(path)?.[1];
    if (name && known.has(name)) out.add(name);
  }
  return [...out].sort();
}
```

In `packages/kit-cli/src/index.ts` add:

```ts
export { SHARED_INPUTS, affectedPrototypes, previewHost, slugPart } from "./hosting.js";
```

In `packages/kit-cli/package.json`, add to `"exports"`, next to the existing `"."` entry and in the same shape as it:

```json
"./hosting": { "types": "./dist/hosting.d.ts", "import": "./dist/hosting.js" }
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `pnpm --filter @cogitato/kit-cli exec vitest run test/hosting.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kit-cli
git commit -m "kit-cli: previewHost and affectedPrototypes for hosted previews" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The workspace model, and the template moved into it

This task changes the model and the template together, because every existing kit-cli test reads
the template.

**Files:**
- Move: `templates/prototype-react/` → `templates/workspace-react/` (layout below)
- Modify:
  - `packages/kit-cli/src/project.ts` and `src/index.ts`;
  - `src/validate.ts`, `src/doctor.ts`, `src/gaps.ts`, `src/rules/tsx.ts` and `src/hook.ts` (only `checkedByHook` and its imports);
  - `pnpm-workspace.yaml`;
  - `packages/kit-cli/test/helpers.ts`, plus every test that calls `projectAt(templateDir)`.
- Create: `packages/kit-cli/src/workspace.ts` (`validateWorkspace` only in this task)
- Test: `packages/kit-cli/test/workspace.test.ts`

**Interfaces:**
- Consumes: `validateProject(designDir, contractDir)` from Task 1.
- Produces, in `project.ts`:
  ```ts
  export const WORKSPACE_LAYOUT = { contract: "design/contract", kit: "kit", prototypes: "prototypes" } as const;
  export const LAYOUT = { design: "design", flowsJson: "design/flows.json", src: "src", screens: "src/screens", flowsTs: "src/flows.ts", screenFile: "screen.tsx" } as const;
  export interface Workspace { root: string; abs(rel: string): string; rel(abs: string): string }
  export interface Project extends Workspace { name: string; workspace: Workspace }
  export function findWorkspace(from?: string): Workspace | undefined;
  export function workspaceAt(root: string): Workspace;
  export function listPrototypes(ws: Workspace): string[];
  export function projectIn(ws: Workspace, name: string): Project;      // throws KitError if missing
  export function projectAt(root: string): Project;                     // a prototype root; throws if not in a workspace
  export function findProject(from?: string): Project | undefined;      // inside prototypes/<name>, or the only prototype
  export function resolvePrototype(ws: Workspace, name?: string, from?: string): Project; // throws KitError naming the choices
  export function readContract(project: Project): ContractView;         // reads from project.workspace
  ```
- Produces, in `workspace.ts`: `validateWorkspace(ws: Workspace): ValidationResult`. Issue files are workspace-relative.
- **Removed:** `LAYOUT.contract` and `LAYOUT.kit` (now in `WORKSPACE_LAYOUT`), and `isKitFile` (kit files aren't in a prototype anymore).

- [ ] **Step 1: Move the template into the workspace layout**

```bash
git mv templates/prototype-react templates/workspace-react
cd templates/workspace-react
mkdir -p prototypes/checkout
git mv src index.html vite.config.ts tsconfig.json netlify.toml prototypes/checkout/
mkdir -p prototypes/checkout/design && git mv design/flows.json prototypes/checkout/design/flows.json
git mv prototypes/checkout/src/kit kit
cp package.json prototypes/checkout/package.json && git add prototypes/checkout/package.json
cd ../..
```

The result is `design/contract/`, `kit/`, `prototypes/checkout/{package.json,index.html,vite.config.ts,tsconfig.json,netlify.toml,src,design/flows.json}`, plus `CLAUDE.md`, `README.md`, `.claude/`, `.gitignore`, `.env.example` and the root `package.json`.

- [ ] **Step 2: Rewrite the two package.json files and add the workspace file**

`templates/workspace-react/package.json` (the workspace root; it holds the tools and shared deps):

```json
{
  "name": "@cogitato/template-workspace-react",
  "private": true,
  "license": "Apache-2.0",
  "version": "0.1.0",
  "description": "Cogitato design workspace template: one design kit, a folder per prototype. Ships the Acme Shop kit and a checkout prototype.",
  "type": "module",
  "scripts": {
    "dev": "kit dev",
    "build": "pnpm -r --filter \"./prototypes/**\" build",
    "validate": "kit validate",
    "kit": "kit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@cogitato/contract": "workspace:*",
    "@cogitato/kit-cli": "workspace:*",
    "@cogitato/kit-mcp": "workspace:*",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "playwright": "^1.64.1",
    "typescript": "^5.7.2"
  }
}
```

`templates/workspace-react/prototypes/checkout/package.json`:

```json
{
  "name": "@cogitato/template-checkout",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "kit export-flows && vite",
    "build": "kit validate && kit export-flows && tsc --noEmit && vite build && kit snapshots",
    "typecheck": "tsc --noEmit",
    "kit": "kit"
  },
  "dependencies": {
    "@cogitato/runtime": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@cogitato/contract": "workspace:*",
    "@cogitato/kit-cli": "workspace:*",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "playwright": "^1.64.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7"
  }
}
```

`templates/workspace-react/_pnpm-workspace.yaml`. It's named with a leading underscore so that, inside this monorepo, it doesn't split the workspace. create-cogitato renames it (Task 9).

```yaml
packages:
  - prototypes/*
allowBuilds:
  esbuild: true
```

Root `pnpm-workspace.yaml`: replace `- "templates/*"` with:

```yaml
  - "templates/workspace-react"
  - "templates/workspace-react/prototypes/*"
```

`prototypes/checkout/tsconfig.json`: change `paths` and `include` so that `@/kit/*` resolves to the shared kit. TypeScript picks the longest matching prefix, so `@/kit/*` wins over `@/*`.

```json
    "paths": { "@/kit/*": ["../../kit/*"], "@/*": ["./src/*"] }
  },
  "include": ["src", "../../kit", "vite.config.ts"]
```

`prototypes/checkout/design/flows.json`: its `"$schema"` stays `"../node_modules/@cogitato/contract/schema/flows.schema.json"`, which is still correct relative to the prototype.

`design/contract/gaps.json`: its `$schema` stays `../../node_modules/@cogitato/contract/schema/gaps.schema.json`, which is correct relative to the workspace root, where `@cogitato/contract` is now a devDependency.

Run: `pnpm install`
Expected: it succeeds and lists `templates/workspace-react` and `templates/workspace-react/prototypes/checkout`.

- [ ] **Step 3: Write the failing workspace tests**

Add to `packages/kit-cli/test/helpers.ts`, replacing `templateDir` and `copyTemplate`:

```ts
export const workspaceDir = fileURLToPath(new URL("../../../templates/workspace-react", import.meta.url));
export const templateDir = join(workspaceDir, "prototypes", "checkout");

/**
 * Copies the template workspace (no node_modules) to a temp folder and returns the checkout
 * prototype's folder. With `second`, adds prototypes/onboarding as a copy of checkout.
 */
export function copyTemplate(opts: { second?: boolean } = {}): string {
  const ws = mkdtempSync(join(tmpdir(), "cogitato-ws-"));
  for (const part of ["design", "kit", "package.json", ".env.example"]) {
    cpSync(join(workspaceDir, part), join(ws, part), { recursive: true });
  }
  const proto = join(ws, "prototypes", "checkout");
  for (const part of ["src", "design", "package.json"]) {
    cpSync(join(templateDir, part), join(proto, part), { recursive: true });
  }
  if (opts.second) cpSync(proto, join(ws, "prototypes", "onboarding"), { recursive: true });
  return proto;
}
```

Existing callers keep working: `copyTemplate()` still returns a prototype root, and ops like `{ file: "src/..." }` and `{ file: "design/flows.json" }` stay prototype-relative. Callers that edit the contract must now use `../../design/contract/...`, so search the tests for `"design/contract` and change each one.

```ts
// packages/kit-cli/test/workspace.test.ts
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KitError, findProject, findWorkspace, listPrototypes, readContract, resolvePrototype, validateWorkspace } from "../src/index.js";
import { applyOps, copyTemplate, templateDir, workspaceDir } from "./helpers.js";

let proto: string | undefined;
afterEach(() => {
  if (proto) rmSync(dirname(dirname(proto)), { recursive: true, force: true });
  proto = undefined;
});

describe("finding the workspace and prototypes", () => {
  it("finds the workspace from its root, a prototype, and deep inside one", () => {
    for (const from of [workspaceDir, templateDir, join(templateDir, "src", "screens")]) {
      expect(findWorkspace(from)?.root).toBe(workspaceDir);
    }
  });

  it("lists prototypes that have a package.json", () => {
    proto = copyTemplate({ second: true });
    expect(listPrototypes(findWorkspace(proto)!)).toEqual(["checkout", "onboarding"]);
  });

  it("picks the prototype you're in, or the only one", () => {
    expect(findProject(join(templateDir, "src"))?.name).toBe("checkout");
    expect(findProject(workspaceDir)?.name).toBe("checkout");
  });

  it("asks which prototype when there are several and you're at the root", () => {
    proto = copyTemplate({ second: true });
    const ws = findWorkspace(proto)!;
    expect(findProject(ws.root)).toBeUndefined();
    expect(() => resolvePrototype(ws, undefined, ws.root)).toThrow(KitError);
    expect(() => resolvePrototype(ws, undefined, ws.root)).toThrow(/checkout, onboarding/);
    expect(resolvePrototype(ws, "onboarding").name).toBe("onboarding");
    expect(() => resolvePrototype(ws, "nope")).toThrow(/There's no prototype called "nope"/);
  });

  it("reads the shared contract for every prototype", () => {
    expect(readContract(findProject(templateDir)!).manifests.has("Button")).toBe(true);
  });

  it("is not a workspace outside one", () => {
    expect(findWorkspace(dirname(workspaceDir))).toBeUndefined();
  });
});

describe("validateWorkspace", () => {
  it("validates the template workspace with no issues", () => {
    expect(validateWorkspace(findWorkspace(workspaceDir)!)).toEqual({ ok: true, issues: [] });
  });

  it("reports each prototype's problems with workspace paths, and the contract's once", () => {
    proto = copyTemplate({ second: true });
    const onboarding = join(dirname(proto), "onboarding");
    applyOps(onboarding, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: 'id: "cart"', with: 'id: "Cart!"' }]);
    applyOps(proto, [{ op: "replace", file: "../../design/contract/tokens.json", find: '"$schema"', with: '"$schemaX"' }]);
    const r = validateWorkspace(findWorkspace(proto)!);
    const files = [...new Set(r.issues.map((i) => i.file.split("/").slice(0, 2).join("/")))];
    expect(files).toContain("prototypes/onboarding");
    expect(files.filter((f) => f.startsWith("design/")).length).toBe(1);
    expect(files).not.toContain("prototypes/checkout");
  });
});
```

Two notes on these fixtures:
- **Screen id:** the exact `find` string must match the template's cart screen. Check `prototypes/checkout/src/screens/cart/screen.tsx` and adjust `find` to a string that occurs once there.
- **Contract edit:** any edit that makes the contract invalid works. The test only checks that contract issues are reported once and under `design/`.

- [ ] **Step 4: Run them and see them fail**

Run: `pnpm --filter @cogitato/kit-cli exec vitest run test/workspace.test.ts`
Expected: FAIL, because `findWorkspace` and the other new functions don't exist yet.

- [ ] **Step 5: Implement the model in `project.ts`**

Replace lines 1–49 of `packages/kit-cli/src/project.ts` (the imports, `LAYOUT`, `Project`, `findProject` and `projectAt`):

```ts
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
  return projectIn(ws, basename(resolve(root)));
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
```

Delete `isKitFile`. In `readContract`, read from the workspace:

```ts
  const ws = project.workspace;
  const tokensJson = readJson<DesignTokens>(ws.abs(`${WORKSPACE_LAYOUT.contract}/tokens.json`));
  // ...
  const dir = ws.abs(`${WORKSPACE_LAYOUT.contract}/components`);
```

Check that `packages/kit-cli/src/errors.ts` doesn't import `project.ts`, so the new import makes no cycle. It doesn't today.

- [ ] **Step 6: Adapt the consumers**

`validate.ts`: add `skipContract` to the options, use the workspace contract and drop `isKitFile`:

```ts
export interface ValidateOptions {
  /** Only check the design contract (the workspace's design/contract and this prototype's design/ files). */
  contractOnly?: boolean;
  /** Don't check the shared contract (validateWorkspace checks it once). */
  skipContract?: boolean;
  files?: string[];
}
```

```ts
  if (touches((f) => f.startsWith(`${LAYOUT.design}/`))) {
    const contractDir = project.workspace.abs(WORKSPACE_LAYOUT.contract);
    const r = validateProject(project.abs(LAYOUT.design), contractDir);
    for (const i of r.issues) {
      const shared = i.file.startsWith("contract/");
      if (shared && opts.skipContract) continue;
      // Contract issues are named from the workspace root, prototype issues from the prototype.
      issues.push({ ...i, file: shared ? `${WORKSPACE_LAYOUT.contract}/${i.file.slice("contract/".length)}` : `${LAYOUT.design}/${i.file}` });
    }
  }
```

In the tsx loop, change `if (!inScope(file) && (!isTsx || isKitFile(file))) continue;` to `if (!inScope(file) && !isTsx) continue;`. Also update the imports.

`doctor.ts` (line 73) becomes:

```ts
  const contract = validateProject(project.abs(LAYOUT.design), project.workspace.abs(WORKSPACE_LAYOUT.contract));
```

and its dependency check reads the workspace's `node_modules`, where the tools are now installed:

```ts
  const installed = ["@cogitato/contract", "@cogitato/kit-mcp"].every((p) => existsSync(project.workspace.abs(`node_modules/${p}/package.json`)))
    && existsSync(project.abs("node_modules/@cogitato/runtime/package.json"));
```

`gaps.ts`:
- `FILE` becomes `` `${WORKSPACE_LAYOUT.contract}/gaps.json` ``;
- every `project.abs(FILE)` becomes `project.workspace.abs(FILE)`;
- `gitUser` runs with `cwd: project.workspace.root`.

`rules/tsx.ts`, `kitImportName`: a relative import reaches the shared kit as `../../kit/...` from the prototype root.

```ts
  else if (specifier.startsWith(".")) {
    const target = posix.normalize(posix.join(posix.dirname(file), specifier));
    const kit = `../../${WORKSPACE_LAYOUT.kit}/`;
    if (target.startsWith(kit)) rest = target.slice(kit.length);
  }
```

Remove the `inKit = isKitFile(file)` logic from line 72. It becomes `const inKit = false;`, then delete the branches that depend on it. Kit files are no longer prototype files.

`hook.ts`, `checkedByHook`: drop `isKitFile`, keeping:

```ts
  return rel.startsWith(`${LAYOUT.src}/`) && /\.(tsx?|css)$/.test(rel) && !rel.endsWith(".d.ts");
```

Create `packages/kit-cli/src/workspace.ts`:

```ts
import { validateProject, type ValidationResult } from "@cogitato/contract";
import type { Issue } from "./issue.js";
import { WORKSPACE_LAYOUT, listPrototypes, projectIn, type Workspace } from "./project.js";
import { validate } from "./validate.js";

// Work across every prototype in a workspace.

/** Checks the shared contract once, then every prototype. Issue files are workspace-relative. */
export function validateWorkspace(ws: Workspace): ValidationResult {
  const issues: Issue[] = [];
  const contract = validateProject(ws.abs("design"), ws.abs(WORKSPACE_LAYOUT.contract));
  issues.push(
    ...contract.issues
      .filter((i) => i.file.startsWith("contract/"))
      .map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.contract}/${i.file.slice("contract/".length)}` })),
  );
  for (const name of listPrototypes(ws)) {
    const r = validate(projectIn(ws, name), { skipContract: true });
    issues.push(...r.issues.map((i) => ({ ...i, file: `${WORKSPACE_LAYOUT.prototypes}/${name}/${i.file}` })));
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
```

In `src/index.ts`:
- export `WORKSPACE_LAYOUT`, `findWorkspace`, `workspaceAt`, `listPrototypes`, `projectIn`, `resolvePrototype` and `type Workspace` from `./project.js`;
- export `validateWorkspace` from `./workspace.js`;
- remove `isKitFile` if it's exported.

- [ ] **Step 7: Run all kit-cli tests**

Run: `pnpm --filter @cogitato/kit-cli build && pnpm --filter @cogitato/kit-cli test`
Expected: all PASS.

Failures to expect and how to fix them:
- **Snapshot tests** whose file paths changed from `design/contract/...` (prototype-relative) to `design/contract/...` (workspace-relative). The strings look the same, so most won't change. Regenerate with `-u` only after reading each diff, and check the message still means the same thing.
- **Bad-fixture cases that edit kit files:** they need `../../kit/...`.

- [ ] **Step 8: Commit**

```bash
git add -A templates pnpm-workspace.yaml pnpm-lock.yaml packages/kit-cli
git commit -m "kit-cli: workspaces with a shared contract and kit, and a folder per prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Vite plugin reads the contract and kit from the workspace

**Files:**
- Modify: `packages/runtime/src/vite.ts:17-37,147-153`
- Test: `packages/runtime/test/vite-paths.test.ts` (create; check whether `packages/runtime/test/` exists and follow its vitest setup)

**Interfaces:**
- Produces: `pathsFor(root: string): Paths`, exported for the test. `Paths` gains `workspace: string`. `contract` and `kit` are resolved from the workspace.

- [ ] **Step 1: Write the failing test**

```ts
// packages/runtime/test/vite-paths.test.ts
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { pathsFor } from "../src/vite.js";

const ws = fileURLToPath(new URL("../../../templates/workspace-react", import.meta.url));
const proto = join(ws, "prototypes", "checkout");

it("takes the contract and kit from the workspace, and flows from the prototype", () => {
  const p = pathsFor(proto);
  expect(p.workspace).toBe(ws);
  expect(p.contract).toBe(join(ws, "design", "contract"));
  expect(p.kit).toBe(join(ws, "kit"));
  expect(p.flowsJson).toBe(join(proto, "design", "flows.json"));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @cogitato/runtime exec vitest run test/vite-paths.test.ts`
Expected: FAIL, because `pathsFor` isn't exported or `workspace` is undefined.

- [ ] **Step 3: Implement**

```ts
interface Paths {
  root: string;
  workspace: string;
  contract: string;
  flowsJson: string;
  tokens: string;
  components: string;
  kit: string;
}

/** The workspace above a prototype: the nearest folder with design/contract. Falls back to the prototype itself. */
function workspaceOf(root: string): string {
  let dir = root;
  for (;;) {
    if (existsSync(join(dir, "design", "contract"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return root;
    dir = parent;
  }
}

export function pathsFor(root: string): Paths {
  const workspace = workspaceOf(root);
  const contract = join(workspace, "design", "contract");
  return {
    root,
    workspace,
    contract,
    flowsJson: join(root, "design", "flows.json"),
    tokens: join(contract, "tokens.json"),
    components: join(contract, "components"),
    kit: join(workspace, "kit"),
  };
}
```

Add `dirname` to the `node:path` import. In `config()`, set the aliases (the more specific `@/kit/` comes first) and deduplicate React, because kit files outside the prototype must use the prototype's copy:

```ts
    config(config) {
      p = pathsFor(config.root ? resolve(config.root) : process.cwd());
      return {
        resolve: {
          alias: [
            { find: /^@\/kit\//, replacement: `${slash(p.kit)}/` },
            { find: /^@\//, replacement: `${slash(join(p.root, "src"))}/` },
          ],
          dedupe: ["react", "react-dom"],
        },
        server: { fs: { allow: [p.workspace] } },
      };
    },
```

In `configureServer`, also watch the kit: `s.watcher.add([p.contract, p.kit]);`. Update the plugin's doc comment so it says the contract and kit come from the workspace.

- [ ] **Step 4: Run the test, then build the template**

Run:
```bash
pnpm --filter @cogitato/runtime build && pnpm --filter @cogitato/runtime test
pnpm --filter @cogitato/template-checkout build
```
Expected: the tests PASS. The build succeeds and its log reports snapshots taken for 8 states, as it did before the move. `templates/workspace-react/prototypes/checkout/dist/__kit-data/flows.json` exists.

- [ ] **Step 5: Check the canvas in the browser pane**

Update `.claude/launch.json`:
- the "prototype" config gets `"runtimeArgs": ["--filter", "@cogitato/template-checkout", "dev"]`;
- "prototype-build" gets `"--filter", "@cogitato/template-checkout"`.

Start "prototype" and open `/__canvas`. Expected:
- 8 frames, and a clicked frame goes live with the kit's styles;
- `/__kit` lists Banner and Button.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime .claude/launch.json
git commit -m "runtime: take the design contract and kit from the workspace" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: CLI: choosing a prototype, `kit prototypes`, `kit dev`, `kit new-prototype`

**Files:**
- Modify: `packages/kit-cli/src/cli.ts` and `src/workspace.ts`
- Test: `packages/kit-cli/test/cli-workspace.test.ts`

**Interfaces:**
- Consumes: `findWorkspace`, `resolvePrototype`, `listPrototypes` and `validateWorkspace` from Task 3.
- Produces:
  - `createPrototype(ws: Workspace, name: string): { name: string; files: string[] }` in `workspace.ts`;
  - the CLI flag `--prototype <name>` (alias `-p`) on every per-prototype command;
  - the commands `kit prototypes`, `kit dev [name]` and `kit new-prototype <name>`;
  - `kit validate` with no prototype in a workspace that has several checks all of them.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/kit-cli/test/cli-workspace.test.ts
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { createPrototype, findWorkspace, listPrototypes, validateWorkspace } from "../src/index.js";
import { copyTemplate } from "./helpers.js";

let proto: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  if (proto) rmSync(dirname(dirname(proto)), { recursive: true, force: true });
  proto = undefined;
});

const run = async (cwd: string, ...argv: string[]) => {
  const out: string[] = [];
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.spyOn(process.stdout, "write").mockImplementation((s) => (out.push(String(s)), true));
  const code = await main(argv);
  vi.restoreAllMocks();
  return { code, out: out.join("") };
};

it("lists prototypes", async () => {
  proto = copyTemplate({ second: true });
  const r = await run(dirname(dirname(proto)), "prototypes");
  expect(r.out.trim().split("\n")).toEqual(["checkout", "onboarding"]);
});

it("asks which prototype for a per-prototype command at the root, and takes --prototype", async () => {
  proto = copyTemplate({ second: true });
  const root = dirname(dirname(proto));
  const asked = await run(root, "link", "cart");
  expect(asked.code).toBe(1);
  expect(asked.out).toMatch(/several prototypes \(checkout, onboarding\)/);
  const r = await run(root, "link", "cart", "--prototype", "onboarding");
  expect(r.code).toBe(0);
  expect(r.out).toMatch(/\/cart\?fixture=default/);
});

it("validates every prototype from the root", async () => {
  proto = copyTemplate({ second: true });
  const r = await run(dirname(dirname(proto)), "validate", "--json");
  expect(r.code).toBe(0);
});

it("creates a new prototype that validates", () => {
  proto = copyTemplate();
  const ws = findWorkspace(proto)!;
  const r = createPrototype(ws, "onboarding");
  expect(listPrototypes(ws)).toEqual(["checkout", "onboarding"]);
  const pkg = JSON.parse(readFileSync(ws.abs("prototypes/onboarding/package.json"), "utf8"));
  expect(pkg.name).toBe("onboarding");
  expect(pkg.dependencies["@cogitato/runtime"]).toBe(JSON.parse(readFileSync(ws.abs("prototypes/checkout/package.json"), "utf8")).dependencies["@cogitato/runtime"]);
  expect(existsSync(ws.abs("prototypes/onboarding/src/screens/home/screen.tsx"))).toBe(true);
  expect(r.files).toContain("prototypes/onboarding/src/flows.ts");
  expect(validateWorkspace(ws).issues.filter((i) => i.file.startsWith("prototypes/onboarding"))).toEqual([]);
});

it("refuses bad or taken names in plain words", () => {
  proto = copyTemplate();
  const ws = findWorkspace(proto)!;
  expect(() => createPrototype(ws, "checkout")).toThrow(/already a prototype called "checkout"/);
  expect(() => createPrototype(ws, "My Flow")).toThrow(/lowercase words with dashes/);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @cogitato/kit-cli exec vitest run test/cli-workspace.test.ts`
Expected: FAIL, because the `prototypes` command and `createPrototype` don't exist.

- [ ] **Step 3: Implement `createPrototype`**

Add to `packages/kit-cli/src/workspace.ts`:

```ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KitError } from "./errors.js";
import { exportFlows } from "./export-flows.js";
import { createScreen } from "./scaffold.js";

// Files a new prototype copies from an existing one, so it gets the same pinned versions and setup.
const SKELETON = ["package.json", "index.html", "vite.config.ts", "tsconfig.json", "netlify.toml", "src/main.tsx", "src/styles/global.css"];

const EMPTY_FLOWS = `import { defineFlows } from "@cogitato/runtime";

// How screens connect. Each step is "{screen id}.{state}". \`kit export-flows\` turns this into
// design/flows.json for the canvas; steps appear in the order they're first mentioned.
export default defineFlows([]);
`;

/** Starts prototypes/<name>/ from an existing prototype's setup, with one empty Home screen. */
export function createPrototype(ws: Workspace, name: string): { name: string; files: string[] } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new KitError(`"${name}" can't be a prototype name. Use lowercase words with dashes, like "onboarding" or "account-settings".`);
  }
  const existing = listPrototypes(ws);
  if (existing.includes(name)) throw new KitError(`There's already a prototype called "${name}". Pick another name.`);
  if (!existing.length) throw new KitError("There's no prototype here to copy the setup from. Ask a developer to check the workspace.");
  const from = ws.abs(`${WORKSPACE_LAYOUT.prototypes}/${existing[0]}`);
  const to = ws.abs(`${WORKSPACE_LAYOUT.prototypes}/${name}`);
  const files: string[] = [];
  for (const rel of SKELETON) {
    if (!existsSync(join(from, rel))) continue;
    mkdirSync(join(to, rel, ".."), { recursive: true });
    copyFileSync(join(from, rel), join(to, rel));
    files.push(`${WORKSPACE_LAYOUT.prototypes}/${name}/${rel}`);
  }
  const pkgPath = join(to, "package.json");
  writeFileSync(pkgPath, JSON.stringify({ ...JSON.parse(readFileSync(pkgPath, "utf8")), name }, null, 2) + "\n");
  const html = join(to, "index.html");
  if (existsSync(html)) writeFileSync(html, readFileSync(html, "utf8").replace(/<title>[^<]*<\/title>/, `<title>${name} prototype</title>`));
  mkdirSync(join(to, "src", "screens"), { recursive: true });
  writeFileSync(join(to, "src", "flows.ts"), EMPTY_FLOWS);
  files.push(`${WORKSPACE_LAYOUT.prototypes}/${name}/src/flows.ts`);
  const project = projectIn(ws, name);
  const screen = createScreen(project, { id: "home", route: "/", title: "Home" });
  files.push(...screen.files.map((f) => `${WORKSPACE_LAYOUT.prototypes}/${name}/${f}`));
  exportFlows(project);
  return { name, files };
}
```

Two things to check:
- **`createScreen`'s options:** look at `CreateScreenOptions` in `scaffold.ts`. It needs `id`, and takes optional `route` and `title`, as above.
- **An empty `defineFlows([])`:** confirm `exportFlows` accepts it. If the registry reports an issue for a screen that isn't in any flow, give `EMPTY_FLOWS` a flow containing only `home.default`:

```ts
export default defineFlows([{ id: "main", title: "Main", edges: [] }]);
```

- [ ] **Step 4: Implement the CLI**

In `cli.ts`:
- **Imports:** add `findWorkspace`, `listPrototypes`, `resolvePrototype`, `validateWorkspace`, `createPrototype` and `type Workspace`.
- **Flags:** add `"prototype"` to mri's `string` list, with `alias: { p: "prototype" }`.
- **Help:** add these lines to `HELP` after `kit doctor`:

```
  kit prototypes
      List the prototypes in this workspace.
  kit new-prototype <name>
      Start a new prototype in prototypes/<name>, with the same setup as the others.
  kit dev [name]
      Run a prototype (the one you're in, or the only one) with its canvas.

Commands that work on one prototype take --prototype <name> when you're at the workspace root.
```

- **Helpers:** replace the `project()` helper with two:

```ts
function workspace(): Workspace {
  const ws = findWorkspace();
  if (!ws) throw new UsageError("This folder isn't a Cogitato workspace: there's no design/contract folder here or above it.");
  return ws;
}

function project(name?: string): Project {
  return resolvePrototype(workspace(), name, process.cwd());
}
```

Inside `main`, define `const proto = () => project(opt("prototype"));` and replace every `project()` call with `proto()`. `resolvePrototype` throws `KitError`, so a missing choice exits with code 1 and a readable message.

- **Validate:** with no prototype chosen, check them all.

```ts
      case "validate": {
        const files = args.files === undefined ? undefined : [args.files, ...rest].flat().map(String).filter(Boolean);
        const ws = workspace();
        const single = opt("prototype") || files || listPrototypes(ws).length === 1 || findProjectHere(ws);
        const r = single ? validate(proto(), { contractOnly: args.contract, ...(files ? { files } : {}) }) : validateWorkspace(ws);
        out(args.json ? JSON.stringify(toReport(r), null, 2) : formatResult(r));
        return r.ok ? 0 : 1;
      }
```

with the helper:

```ts
/** True when the working directory is inside one of the workspace's prototypes. */
const findProjectHere = (ws: Workspace) => ws.rel(process.cwd()).startsWith("prototypes/");
```

- **New commands:**

```ts
      case "prototypes":
        out(args.json ? JSON.stringify(listPrototypes(workspace())) : listPrototypes(workspace()).join("\n"));
        return 0;
      case "new-prototype": {
        const r = createPrototype(workspace(), need(rest[0], "the prototype name"));
        out(args.json ? JSON.stringify(r, null, 2) : `Started prototypes/${r.name} with a Home screen. Install its parts with pnpm install, then run it with pnpm dev ${r.name}.`);
        return 0;
      }
      case "dev": {
        const p = project(rest[0] ?? opt("prototype"));
        const r = spawnSync("pnpm", ["--filter", `./prototypes/${p.name}`, "dev"], { cwd: p.workspace.root, stdio: "inherit", shell: process.platform === "win32" });
        return r.status ?? 2;
      }
```

Add `import { spawnSync } from "node:child_process";`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @cogitato/kit-cli build && pnpm --filter @cogitato/kit-cli test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/kit-cli
git commit -m "kit: pick a prototype, list them, run one, and start a new one" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Preview links and saving across a workspace

**Files:**
- Modify: `packages/kit-cli/src/links.ts:41-62` and `src/save.ts`
- Test: `packages/kit-cli/test/hook-save.test.ts` (update the save tests); create `packages/kit-cli/test/preview-link.test.ts`

**Interfaces:**
- Consumes: `previewHost` and `affectedPrototypes` (Task 2), and `listPrototypes` and `projectIn` (Task 3).
- Produces:
  - `previewLink(project: Project, branch: string, node?: string): string | undefined`. It reads the **workspace's** `package.json`, `"kit": { "previewUrl": "https://{host}.<domain>", "org": "<org slug>" }`. Without both, or without `{host}`, it returns undefined.
  - `saveVersion(ws: Workspace, opts?: SaveOptions): SaveResult`. It takes the workspace, not a prototype.
  - `SaveResult.previews: { prototype: string; url: string }[]` replaces `preview?: string`.
  - `branchSlug` is removed (replaced by `previewHost`).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/kit-cli/test/preview-link.test.ts
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { previewLink, projectAt } from "../src/index.js";
import { copyTemplate } from "./helpers.js";

let proto: string | undefined;
afterEach(() => proto && rmSync(dirname(dirname(proto)), { recursive: true, force: true }));

const setKit = (ws: string, kit: object) => {
  const path = join(ws, "package.json");
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), kit }, null, 2));
};

it("builds the hosted canvas link from the workspace's previewUrl and org", () => {
  proto = copyTemplate();
  setKit(dirname(dirname(proto)), { previewUrl: "https://{host}.cogitato-preview.app", org: "acme-shop-demo" });
  expect(previewLink(projectAt(proto), "design/sam-0102")).toBe(
    "https://design-sam-0102--checkout--acme-shop-demo.cogitato-preview.app/__canvas",
  );
  expect(previewLink(projectAt(proto), "design/sam-0102", "cart.empty")).toMatch(/\/__canvas\?focus=cart.empty$/);
});

it("has no link without hosting set up", () => {
  proto = copyTemplate();
  expect(previewLink(projectAt(proto), "main")).toBeUndefined();
  setKit(dirname(dirname(proto)), { previewUrl: "https://{branch}--x.netlify.app" });
  expect(previewLink(projectAt(proto), "main")).toBeUndefined();
});
```

In `hook-save.test.ts`, change the save tests:
- `saveVersion(project, …)` becomes `saveVersion(project.workspace, …)`;
- `r.preview` becomes `r.previews`;
- the git repo is initialized at the **workspace** root, `dirname(dirname(proto))`.

Then add this test:

```ts
it("links a preview for each prototype the branch changed", () => {
  const proto = copyTemplate({ second: true });
  const ws = dirname(dirname(proto));
  const remote = mkdtempSync(join(tmpdir(), "cogitato-remote-"));
  const g = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8" });
  try {
    const pkgPath = join(ws, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    writeFileSync(pkgPath, JSON.stringify({ ...pkg, kit: { previewUrl: "https://{host}.cogitato-preview.app", org: "acme" } }, null, 2));
    g(remote, "init", "-q", "--bare", "-b", "main");
    g(ws, "init", "-q", "-b", "main");
    g(ws, "config", "user.name", "Sam Designer");
    g(ws, "config", "user.email", "sam@example.com");
    g(ws, "add", "-A");
    g(ws, "commit", "-q", "-m", "start");
    g(ws, "remote", "add", "origin", remote);
    g(ws, "push", "-q", "-u", "origin", "main");
    g(ws, "remote", "set-head", "origin", "main");

    const screen = join(ws, "prototypes", "onboarding", "src", "screens", "cart", "screen.tsx");
    writeFileSync(screen, readFileSync(screen, "utf8") + "\n// onboarding tweak\n");
    const r = saveVersion(workspaceAt(ws), { now: new Date("2026-11-12T10:00:00Z") });

    expect(r.pushed).toBe(true);
    expect(r.previews).toEqual([
      { prototype: "onboarding", url: "https://design-sam-designer-20261112--onboarding--acme.cogitato-preview.app/__canvas" },
    ]);
    expect(r.message).toContain(r.previews[0]!.url);
  } finally {
    rmSync(ws, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  }
});
```

Imports this test needs: `mkdtempSync`, `readFileSync`, `rmSync` and `writeFileSync` from `node:fs`, `tmpdir` from `node:os`, `dirname` and `join` from `node:path`, `spawnSync` from `node:child_process`, `saveVersion` and `workspaceAt` from `../src/index.js`, and `copyTemplate` from `./helpers.js`.

The branch name comes from `slug(user)` and the date, so "Sam Designer" on 2026-11-12 gives `design/sam-designer-20261112`, as in the existing save tests.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @cogitato/kit-cli exec vitest run test/preview-link.test.ts test/hook-save.test.ts`
Expected: FAIL, because `previewLink` still reads `{branch}` from the prototype's `package.json`.

- [ ] **Step 3: Implement `previewLink`**

Replace `branchSlug` and `previewLink` in `links.ts`:

```ts
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
  if (typeof kit?.previewUrl !== "string" || !kit.previewUrl.includes("{host}") || typeof kit.org !== "string") return undefined;
  const host = previewHost({ branch, prototype: project.name, org: kit.org });
  const base = kit.previewUrl.replace("{host}", host).replace(/\/+$/, "");
  return `${base}${CANVAS_PATH}${node ? `?focus=${encodeURIComponent(node)}` : ""}`;
}
```

Add `import { previewHost } from "./hosting.js";`. Remove `branchSlug` from `index.ts`.

- [ ] **Step 4: Implement `saveVersion` for a workspace**

Change `save.ts`:
- **The `git` helper:** it takes a `Workspace` and runs with `cwd: ws.root`.
- **`saveVersion(ws: Workspace, opts)`:**
  1. Run `exportFlows(projectIn(ws, name))` for every name in `listPrototypes(ws)`.
  2. Build `describeChanges` per prototype from `git show HEAD:prototypes/<name>/design/flows.json`.
  3. Prefix each change with `<name>: ` when there's more than one prototype.
  4. Filter out a `prototypes/<name>/design/flows.json` whose only change is the commit stamp, the same rule as before applied to each prototype.
  5. Collect validation issues with `validateWorkspace(ws)`.
- **`summarize`:** match screens with `^prototypes\/([^/]+)\/src\/screens\/(.+)\/[^/]+$`, with `Update <screen>` (one prototype) and `Update <prototype>: <screen>` (several). `files.some((f) => f.startsWith("design/contract/"))` gives "Update the design kit", and so does `f.startsWith("kit/")`.
- **Previews after a successful push:**

```ts
function defaultBranch(ws: Workspace, remote: string): string {
  const head = git(ws, ["symbolic-ref", "--short", `refs/remotes/${remote}/HEAD`]);
  if (head.ok && head.out) return head.out;
  return git(ws, ["rev-parse", "--verify", "--quiet", `${remote}/main`]).ok ? `${remote}/main` : "main";
}

function previewsFor(ws: Workspace, remote: string, branch: string): { prototype: string; url: string }[] {
  const diff = git(ws, ["diff", "--name-only", `${defaultBranch(ws, remote)}...HEAD`]);
  const changed = diff.ok ? diff.out.split("\n").filter(Boolean) : [];
  return affectedPrototypes(changed, listPrototypes(ws)).flatMap((name) => {
    const url = previewLink(projectIn(ws, name), branch);
    return url ? [{ prototype: name, url }] : [];
  });
}
```

- **The message:** with one preview, `` ` Your preview will be at ${url} in a minute or two.` ``. With several, `" Your previews will be ready in a minute or two: "` followed by `"<name>: <url>"` items joined with `"; "`.
- **The result:** `previews` instead of `preview`.

- [ ] **Step 5: Update the callers and run the tests**

In `cli.ts`, `case "save"` becomes `saveVersion(workspace(), …)`. The MCP server is updated in Task 8.

Run: `pnpm --filter @cogitato/kit-cli build && pnpm --filter @cogitato/kit-cli test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/kit-cli
git commit -m "kit save: one version across the workspace, a preview link per changed prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hooks in a workspace

**Files:**
- Modify: `packages/kit-cli/src/hook.ts:43-104`
- Test: `packages/kit-cli/test/hook-save.test.ts` (the hook tests)

**Interfaces:**
- Produces: `runHook(event, input, start?)`, the same signature as before.
  - **Post-edit:** it picks the prototype from `tool_input.file_path`. For an edit under the workspace's `design/contract/`, it checks the contract.
  - **Session start:** it describes the whole workspace.
- `sessionStartHook(ws: Workspace, opts?)` now takes the workspace.

- [ ] **Step 1: Write the failing tests**

Add to the hook tests:

```ts
it("checks an edit in the second prototype against that prototype", async () => {
  proto = copyTemplate({ second: true });
  const ws = dirname(dirname(proto));
  const file = join(ws, "prototypes", "onboarding", "src", "screens", "cart", "screen.tsx");
  writeFileSync(file, readFileSync(file, "utf8").replace("data-kit-id=", "data-x="));
  const r = await runHook("post-edit", { cwd: ws, tool_input: { file_path: file } });
  expect(r?.decision).toBe("block");
  expect(r?.reason).toMatch(/^Cogitato check of prototypes\/onboarding\/src\/screens\/cart\/screen\.tsx/);
});

it("checks the shared contract when it's edited", async () => {
  proto = copyTemplate({ second: true });
  const ws = dirname(dirname(proto));
  const file = join(ws, "design", "contract", "tokens.json");
  writeFileSync(file, "{ not json");
  const r = await runHook("post-edit", { cwd: ws, tool_input: { file_path: file } });
  expect(r?.decision).toBe("block");
  expect(r?.reason).toMatch(/design\/contract\/tokens\.json/);
});

it("describes every prototype at session start", async () => {
  proto = copyTemplate({ second: true });
  const r = await runHook("session-start", { cwd: dirname(dirname(proto)) });
  expect(r?.hookSpecificOutput?.additionalContext).toMatch(/2 prototypes: checkout \(4 screens, 8 states\), onboarding \(4 screens, 8 states\)/);
});
```

The `replace("data-kit-id=", ...)` must remove an id that the rules require. Check the cart screen and pick an attribute that occurs once there.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @cogitato/kit-cli exec vitest run test/hook-save.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

`runHook`:

```ts
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
```

Add `contractEditHook`:

```ts
/** After an edit to the shared design contract: check the contract, and report problems in it. */
function contractEditHook(ws: Workspace, rel: string): HookOutput | undefined {
  const r = validateWorkspace(ws);
  const own = r.issues.filter((i) => i.file.startsWith(`${WORKSPACE_LAYOUT.contract}/`));
  if (!own.length) return undefined;
  const result = { ok: !own.some((i) => i.severity === "error"), issues: own };
  return result.ok
    ? { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `Cogitato check of ${rel}:\n${formatResult(result)}` } }
    : { decision: "block", reason: `Cogitato check of ${rel}: ${formatResult(result)}\n\n${FIX_ADVICE}` };
}
```

In `postEditHook`, name files from the workspace root, so Claude sees which prototype a problem is in. Use `const shown = \`${WORKSPACE_LAYOUT.prototypes}/${project.name}/${rel}\`` in the two "Cogitato check of" strings. Keep `rel` for `checkedByHook` and `validate`.

`sessionStartHook(ws)`:
- run `doctor` on each prototype, and dedupe problems and warnings by `message`;
- build the first context line from every prototype:

```ts
  const parts = listPrototypes(ws).map((name) => {
    const reg = readRegistry(projectIn(ws, name), sourceFiles(projectIn(ws, name)));
    const states = reg.screens.reduce((n, s) => n + s.fixtures.length, 0);
    return `${name} (${reg.screens.length} screen${reg.screens.length === 1 ? "" : "s"}, ${states} state${states === 1 ? "" : "s"})`;
  });
  const first = `This is a Cogitato design workspace with ${parts.length} prototype${parts.length === 1 ? "" : "s"}: ${parts.join(", ")}. ` +
    "The design kit (design/contract and kit/) is shared by all of them; each prototype is a folder in prototypes/. " +
    "When the person doesn't say which prototype they mean and there's more than one, ask.";
```

Then add `list_prototypes` to `MCP_TOOLS`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @cogitato/kit-cli build && pnpm --filter @cogitato/kit-cli test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kit-cli
git commit -m "kit hooks: check the prototype that was edited, and the shared contract" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The MCP server works on a workspace

**Files:**
- Modify: `packages/kit-mcp/src/index.ts` and `src/server.ts`
- Test: the existing kit-mcp tests (`packages/kit-mcp/test/`). Update them, and add one for the `prototype` argument.

**Interfaces:**
- Consumes: `findWorkspace`, `resolvePrototype`, `listPrototypes` and `saveVersion(ws)`.
- Produces:
  - `resolveWorkspace(env?, cwd?): Workspace | undefined`, replacing `resolveProject`;
  - `createServer(ws: Workspace): McpServer`;
  - every per-prototype tool takes an optional `prototype: string`;
  - a new tool `list_prototypes`.

- [ ] **Step 1: Write the failing test**

Follow the existing kit-mcp tests' client setup (an in-memory transport) and add:

```ts
it("works on the prototype named in the call, and asks when it's missing", async () => {
  // workspace with checkout + onboarding (copy the template, then copy prototypes/checkout to prototypes/onboarding)
  const asked = await client.callTool({ name: "canvas_link", arguments: { step: "cart" } });
  expect(asked.isError).toBe(true);
  expect(JSON.stringify(asked.content)).toMatch(/several prototypes \(checkout, onboarding\)/);
  const r = await client.callTool({ name: "canvas_link", arguments: { step: "cart", prototype: "onboarding" } });
  expect(r.isError).toBeFalsy();
  const list = await client.callTool({ name: "list_prototypes", arguments: {} });
  expect(JSON.stringify(list.content)).toMatch(/checkout.*onboarding/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @cogitato/kit-mcp test`
Expected: FAIL.

- [ ] **Step 3: Implement**

`index.ts`:

```ts
export function resolveWorkspace(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Workspace | undefined {
  for (const start of [env.KIT_PROJECT, env.CLAUDE_PROJECT_DIR, cwd]) {
    const ws = start ? findWorkspace(start) : undefined;
    if (ws) return ws;
  }
  return undefined;
}
```

`serveStdio` uses it. Its error message becomes "kit-mcp: this folder isn't a Cogitato workspace (no design/contract folder here or above it)."

`server.ts`:
- **The server:** `createServer(ws: Workspace)`.
- **Choosing a prototype:**

```ts
const prototypeArg = z.string().optional().describe("Which prototype (a folder in prototypes/). Leave out when there's only one.");
```

  Inside: `const at = (name?: string) => resolvePrototype(ws, name, process.env.KIT_PROJECT);`.
- **Tools:** `create_screen`, `add_state`, `validate`, `canvas_link` and `set_status` get `prototype: prototypeArg` in their `inputSchema`, and call `at(args.prototype)` instead of using `project`.
- **The `validate` tool:**
  - with no `prototype` and several prototypes, it calls `validateWorkspace(ws)`;
  - with `files`, it needs a prototype.
- **Contract tools:** `list_components`, `get_component`, `get_tokens` and `log_gap` read the shared contract. Use `readContract(at(listPrototypes(ws)[0]))`. `addGap` needs a `Project` only for its workspace, so call `addGap(at(listPrototypes(ws)[0]), args)`. The `rules.md` path becomes `ws.abs(\`${WORKSPACE_LAYOUT.contract}/rules.md\`)`.
- **`save_version`:** calls `saveVersion(ws, …)`.
- **New tool:**

```ts
  server.registerTool(
    "list_prototypes",
    {
      title: "List prototypes",
      description: "The prototypes in this design workspace (folders in prototypes/). They all share one design kit.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => run(() => text(listPrototypes(ws).join("\n") || "No prototypes yet.")),
  );
```

- **Instructions:** add one sentence to `INSTRUCTIONS`: "This is a design workspace: several prototypes share one design kit. Pass `prototype` when there's more than one; list_prototypes names them."

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @cogitato/kit-mcp build && pnpm --filter @cogitato/kit-mcp test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kit-mcp
git commit -m "kit-mcp: one server per workspace, tools take the prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `npm create cogitato` makes a workspace

**Files:**
- Modify:
  - `packages/create-cogitato/scripts/bundle-template.mjs` and `src/create.ts`;
  - `packages/create-cogitato/test/create.test.ts`, `README.md`;
  - `.github/workflows/ci.yml`, the root `package.json` scripts if any of them name the template.
- Delete: the root `netlify.toml`

**Interfaces:**
- Produces: `createWorkspace(opts: CreateOptions): CreateResult`, renamed from `createPrototype`. The options are the same, and `CreateResult` gains `prototypes: string[]`.

- [ ] **Step 1: Update the tests to the new layout and see them fail**

In `create.test.ts`:
- rename the calls to `createWorkspace`;
- change path assertions to the workspace layout;
- add this test:

```ts
it("creates a workspace with the checkout prototype, pinned and ready for pnpm", () => {
  const r = createWorkspace({ target: join(tmp, "acme-design"), install: false, git: false, templateDir: bundled });
  expect(r.prototypes).toEqual(["checkout"]);
  expect(existsSync(join(r.dir, "pnpm-workspace.yaml"))).toBe(true);
  expect(existsSync(join(r.dir, "_pnpm-workspace.yaml"))).toBe(false);
  expect(existsSync(join(r.dir, ".gitignore"))).toBe(true);
  const root = JSON.parse(readFileSync(join(r.dir, "package.json"), "utf8"));
  expect(root.name).toBe("acme-design");
  const proto = JSON.parse(readFileSync(join(r.dir, "prototypes/checkout/package.json"), "utf8"));
  expect(proto.name).toBe("checkout");
  expect(JSON.stringify([root, proto])).not.toMatch(/workspace:/);
});
```

`bundled` is the package's built `template/` folder. Follow how the existing test gets it, and run `node scripts/bundle-template.mjs` in a `beforeAll` if the existing test does.

Run: `pnpm --filter create-cogitato test`
Expected: FAIL.

- [ ] **Step 2: Implement the bundle script**

Change `bundle-template.mjs`:
- **Source:** `const source = join(pkgDir, "..", "..", "templates", "workspace-react");`.
- **Skipping folders:** change the `SKIP` filter so `node_modules` and `dist` are skipped at any depth. `basename` already does this.
- **Pinning:** apply the `workspace:` pinning loop to the root `package.json` and to every `prototypes/*/package.json`, through a function `pin(pkgPath, name)`.
  - The root becomes `name: "my-design"` and `version: "0.1.0"`, with `license` and `description` removed.
  - Each prototype becomes `name: <folder name>`, with `license` and `description` removed.
- **The workspace file:** delete the line that writes `pnpm-workspace.yaml`. The template ships `_pnpm-workspace.yaml`, and the bundle keeps it under that name: npm doesn't strip it, but keeping the underscore means a create run inside another pnpm workspace doesn't nest one. Leave it as it is.
- **Commit stamps:** strip `commit` from each `prototypes/*/design/flows.json`.

- [ ] **Step 3: Implement `create.ts`**

- **Rename:** `createPrototype` becomes `createWorkspace`, and `packageName`'s fallback becomes `"my-design"`.
- **Renaming files:** after `cpSync`, rename `_gitignore` and also `_pnpm-workspace.yaml`:

```ts
  for (const [from, to] of [["_gitignore", ".gitignore"], ["_pnpm-workspace.yaml", "pnpm-workspace.yaml"]] as const) {
    if (existsSync(join(dir, from))) renameSync(join(dir, from), join(dir, to));
  }
```

- **Result:** `prototypes` is the folders under `prototypes/` that contain a `package.json`.
- **First commit message:** "Start the design workspace from Cogitato".
- **`USAGE`:** "Start a Cogitato design workspace: one design kit, a folder per prototype.", followed by `npm create cogitato@latest <folder>`. Usually there's one per team or company.
- **Closing message:**

```ts
        `Your design workspace "${r.name}" is ready, with one prototype: checkout (the Acme Shop example).`,
        `Next: open ${r.dir} in Claude Code and describe the first screen you want, or ask for a new prototype ("start a prototype for onboarding").`,
        "It uses the Acme Shop example design kit; swap in your own in design/contract/ and kit/.",
```

- **The bin file:** check whether `packages/create-cogitato/bin/*.js` imports `createPrototype` by name, and update it if so.

- [ ] **Step 4: CI, root files and the old Netlify config**

- **`.github/workflows/ci.yml`:**
  - `--filter @cogitato/template-prototype-react` becomes `--filter @cogitato/template-checkout`;
  - the diff exclusion becomes `':!templates/workspace-react/prototypes/*/design/flows.json'`.
- **The root `netlify.toml`:** run `git rm netlify.toml`. The Acme demo moves to its own org, per spec decision 5.
- **The prototype's `netlify.toml`** (`templates/workspace-react/prototypes/checkout/netlify.toml`): update its header comment for self-hosting. Set the Netlify site's base directory to `prototypes/<name>`, with one site per prototype. Its build command stays `npx playwright install chromium && pnpm build`.
- **Other mentions:** run `git grep -n "prototype-react"` and fix every hit outside `docs/decisions/` (ADRs keep their history).

- [ ] **Step 5: Run the tests**

Run:
```bash
pnpm --filter create-cogitato build && pnpm --filter create-cogitato test
pnpm build && pnpm typecheck && pnpm test
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A packages/create-cogitato .github netlify.toml templates package.json
git commit -m "npm create cogitato: a design workspace with one prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Plugin and template instructions

**Files:**
- Modify:
  - `plugin/skills/new-prototype/SKILL.md`, `plugin/skills/save-version/SKILL.md`;
  - `plugin/.claude-plugin/plugin.json` (version 0.4.0), `plugin/README.md`;
  - `templates/workspace-react/CLAUDE.md`, `templates/workspace-react/README.md`.

There's no code here. Check it with `claude plugin validate plugin` and by reading it.

- [ ] **Step 1: Rewrite `new-prototype`**

```markdown
---
name: new-prototype
description: Start a new prototype in this design workspace, next to the others and sharing their design kit. Use when the designer wants a new prototype or project, not more screens in the current one.
when_to_use: 'For example "start a new prototype for the onboarding flow", "I want a fresh prototype for the settings redesign".'
argument-hint: "[what the prototype is for]"
---

# Start a new prototype

The person is usually a designer. You run every command yourself, and explain each step in one plain line.

Request: $ARGUMENTS

1. **Name it.** Pick a short name from what it's for, in lowercase with dashes (`onboarding`, `account-settings`), and confirm it in one sentence. Check `list_prototypes` so it isn't taken.
2. **Create it** with `pnpm kit new-prototype <name>` in the workspace root. It adds `prototypes/<name>/` with the same setup as the others and an empty Home screen.
3. **Install its parts** with `pnpm install` in the workspace root.
4. **Hand over:** tell the designer it's ready and uses the team's design kit, give the canvas link from `canvas_link` with `prototype: "<name>"` and step `home`, and ask what the first screen should be.

If this folder isn't a Cogitato workspace at all, there's no workspace to add to yet: create one with `npm create cogitato@latest <folder>` next to the current folder, and tell the designer to open it in Claude Code.
```

- [ ] **Step 2: Update `save-version`, step 3**

```markdown
3. Reply in one or two sentences, using the tool's message: whether it was saved, whether it was shared, and the preview links if it has any (one per prototype that changed). Others can open a preview to see the whole flow.
```

- [ ] **Step 3: Update the template's `CLAUDE.md`**

Rewrite the opening and "The design contract is the rulebook" for the workspace:

```markdown
# Design workspace: notes for Claude Code

This is a Cogitato design workspace: one design kit, shared by every prototype in `prototypes/`.
The person working here is usually a designer, not a developer: explain things in plain language,
and never ask them to run commands.

## Where things are
- `design/contract/` is the rulebook for every prototype: tokens (`tokens.json`), components (`components/*.json`), and do's and don'ts (`rules.md`). Read `rules.md` first.
- `kit/` holds the coded kit components. Screens import them as `@/kit/...`.
- Each prototype is a folder in `prototypes/` with its own `src/` and `design/flows.json`. When the person doesn't say which prototype they mean and there's more than one, ask.
```

Then:
- in "How screens work" and the paths that follow, say the paths are inside the prototype's folder (`prototypes/<name>/src/screens/`);
- the "Checking work" commands become `pnpm kit validate` (every prototype) and `pnpm dev <name>`;
- add `list_prototypes` to the tool list.

- [ ] **Step 4: Update the template's `README.md`**

Describe:
- the workspace layout;
- adding a prototype ("ask Claude", or `pnpm kit new-prototype <name>`);
- `pnpm dev <name>`;
- swapping in a company's kit (`design/contract/` and `kit/`);
- hosting: `"kit": { "previewUrl": "https://{host}.<preview domain>", "org": "<org>" }` in the root `package.json`, and the self-hosted Netlify option, with one site per prototype and the base directory set to `prototypes/<name>`.

- [ ] **Step 5: Bump the plugin version and validate**

In `plugin/.claude-plugin/plugin.json`, set `"version": "0.4.0"`. Mention workspaces in `plugin/README.md`.

Run: `claude plugin validate plugin && claude plugin validate .`
Expected: both report no errors.

- [ ] **Step 6: Commit**

```bash
git add plugin templates/workspace-react/CLAUDE.md templates/workspace-react/README.md
git commit -m "Plugin 0.4.0: new prototypes are folders in the design workspace" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: ADR 017, contracts, roadmap, changeset

**Files:**
- Create: `docs/decisions/017-multi-prototype-workspace.md`, `.changeset/multi-prototype-workspace.md`
- Modify: `docs/architecture/interfaces.md`, `docs/roadmap.md`, `README.md`, `CLAUDE.md` (only if it names the template path), `docs/decisions/013-hosting.md` (a status note)
- Modify, in the other repo: `C:\Users\PC\cogitato-platform\docs\superpowers\specs\2026-11-03-hosted-previews-design.md` (add the shared `kit/` folder)

- [ ] **Step 1: Write ADR 017**

```markdown
# ADR 017: A design workspace per org, a folder per prototype

- **Status:** Accepted
- **Date:** 2026-11-12
- **Relates to:** ADR 015 (open core), ADR 016 (naming); platform ADR 001 (hosted previews)

## Context
Until 0.1.0, a repo was one prototype with its own copy of the design kit. Companies make many
prototypes from one kit, and designers shouldn't need to create repos. Hosted previews (platform
ADR 001) build from an org's repo, so the layout is also what the platform reads.

## Decision
- One repo per org, a **design workspace**: `design/contract/` and `kit/` at the root, shared by
  every prototype; each prototype is `prototypes/<name>/` with its own `src/`, `design/flows.json`
  and `package.json` (a pnpm workspace package).
- Work happens on a branch per piece of work (`design/<name>-<date>`); one branch may change several
  prototypes. Who made what comes from git.
- `kit-cli` has two roots: the workspace and the prototype. Commands take `--prototype` (MCP tools
  take `prototype`) when it isn't clear from where you are.
- `kit-cli/hosting` exports `previewHost` (`<branch>--<prototype>--<org>`, one DNS label, hashed
  when over 63 characters) and `affectedPrototypes` (changes to `design/`, `kit/`, the root
  `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` affect every prototype).
- Preview links come from `"kit": { "previewUrl": "https://{host}.<domain>", "org": "<org>" }` in the
  workspace's `package.json`.
- One layout only: the 0.1.0 single-prototype layout isn't supported. No file format changes, so no
  `schemaVersion` bump.

## Consequences
- 0.2.0 is a breaking change for 0.1.0 repos (only our own test repos). Moving one: put the
  prototype's `src/`, `design/flows.json`, `index.html`, configs and `package.json` under
  `prototypes/<name>/`, move `src/kit/` to `kit/`, and add the root `package.json` and
  `pnpm-workspace.yaml` from the template.
- The root `netlify.toml` (the Acme demo) is removed: the demo becomes a customer-style repo in its
  own GitHub org. Self-hosting on Netlify stays possible with one site per prototype (ADR 013).
```

- [ ] **Step 2: Update `interfaces.md`**

- Rewrite the folder layout section to match ADR 017's layout. Use the tree from the spec, plus `kit/`.
- Add a short "Preview hosts" subsection with `previewHost` and three examples taken from `hosting.test.ts`:
  - `design/sam-0102` + `checkout` + `acme-shop-demo` gives `design-sam-0102--checkout--acme-shop-demo`;
  - the slugged case;
  - a shortened case, described in words.
- Add an "Affected prototypes" rule.
- Search the file for `design/flows.json` and `design/contract`, and make sure each mention says which root it's relative to.

- [ ] **Step 3: Update the roadmap, README, ADR 013 and the platform spec**

`docs/roadmap.md`, Phase 3:

```markdown
## Phase 3 — Canvas + hosting
- Canvas app, local mode then hosted mode ([07](architecture/components/07-canvas.md))
- A design workspace per org, a folder per prototype ([ADR 017](decisions/017-multi-prototype-workspace.md)) — first, in the open packages (0.2.0)
- Hosted previews through the platform's GitHub App, built on AWS (platform ADR 001)

**Exit:** a push to `acme-shop-demo/acme-design` produces a protected preview on our preview domain that loads as live frames at `/__canvas`, with no manual steps.
```

The README:
- the status line;
- the quick start (`npm create cogitato@latest acme-design`);
- one paragraph on workspaces.

ADR 013: under Status, add "Self-hosted path only since ADR 017 and platform ADR 001; the Acme demo no longer deploys from this repo."

The platform spec, "Repo layout" tree: add `kit/` under `design/contract/` with the comment "← coded kit components, shared (`@/kit/...`)". Add `kit/**` to the inputs that affect every prototype.

- [ ] **Step 4: Add the changeset**

```markdown
---
"@cogitato/contract": minor
---

Design workspaces: one design kit (`design/contract/`, `kit/`) shared by a folder per prototype (`prototypes/<name>/`). `npm create cogitato` makes a workspace; `kit new-prototype`, `kit prototypes`, `kit dev` and `--prototype` are new; `kit save` links a preview per changed prototype; `@cogitato/kit-cli/hosting` exports `previewHost` and `affectedPrototypes`. Breaking for 0.1.0 repos: see ADR 017.
```

All six packages are in a fixed group, so one entry moves them all to 0.2.0.

- [ ] **Step 5: Commit both repos**

```bash
git add docs README.md CLAUDE.md .changeset
git commit -m "ADR 017: design workspaces; Phase 3 plan in the roadmap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd ../cogitato-platform && git add docs && git commit -m "Spec: the shared kit folder affects every prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && cd ../Protokit
```

---

### Task 12: Verify end to end, then release

- [ ] **Step 1: Run the full suite from a clean install**

```bash
pnpm install --frozen-lockfile && pnpm gen && pnpm build && pnpm typecheck && pnpm test && pnpm check:packages
git status --short
```
Expected:
- everything passes;
- `git status` shows nothing except possibly `templates/workspace-react/prototypes/checkout/design/flows.json`, from the commit stamp;
- `git grep -n "prototype-react\|branchSlug\|isKitFile"` shows hits only in `docs/decisions/`.

- [ ] **Step 2: Run end to end against a local registry**

Follow the distribution phase's local-registry check (Verdaccio through `npx`, in the scratchpad):
1. Publish all six packages there.
2. Then, in a folder outside this repo:

```bash
npm create cogitato@latest acme-design --registry http://localhost:4873
cd acme-design
pnpm kit prototypes            # checkout
pnpm kit new-prototype onboarding && pnpm install
pnpm kit validate              # no problems, both prototypes
pnpm build                     # both prototypes build, with snapshots
```

3. Open the workspace in the browser pane with `pnpm dev checkout`. Check `/__canvas`: 8 frames, and live frames styled by the kit.
4. Open it with `pnpm dev onboarding`. Check `/__canvas`: 1 frame (Home).

- [ ] **Step 3: Check the plugin in the new workspace**

Start Claude Code in `acme-design` with the plugin from this repo (`--plugin-dir plugin`). Check:
- **Session start:** the context names both prototypes.
- **Editing a screen in `prototypes/onboarding`:** it's checked against onboarding.
- **`list_prototypes`:** returns both.

- [ ] **Step 4: Push and stage the release (needs the user)**

1. Push `main`. CI must go green.
2. The Release workflow opens "Version packages" (0.2.0). Ask the user before merging it.
3. Merging it stages 0.2.0 on npm.
4. The user runs `pnpm release:approve` with 2FA.
5. After approval, repeat Step 2 against public npm, with `npm create cogitato@latest`.

That run is this plan's exit.

- [ ] **Step 5: Create the Acme demo workspace (needs the user)**

Once 0.2.0 is public and the user has created the `acme-shop-demo` GitHub org:

```bash
npm create cogitato@latest acme-design
cd acme-design
gh repo create acme-shop-demo/acme-design --private --source . --push
```

Ask before running `gh repo create`, because it creates a repo in the user's org. Add a second prototype, `onboarding`, with `pnpm kit new-prototype onboarding`, so the platform's exit test has an unchanged prototype to check. Commit and push it. The platform plans start from this repo.

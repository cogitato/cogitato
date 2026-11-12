import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FlowManifest } from "@cogitato/contract";
import { checkedByHook, describeChanges, postEditHook, projectAt, runHook, saveVersion, sessionStartHook, workspaceAt, type Project } from "../src/index.js";
import { applyOps, copyTemplate, removeTemplate } from "./helpers.js";

let root: string;
let project: Project;
beforeEach(() => {
  root = copyTemplate();
  project = projectAt(root);
});
afterEach(() => removeTemplate(root));

const edit = (rel: string) => ({ hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: join(root, rel) } });

describe("post-edit hook", () => {
  it("only checks prototype source and the design folder", () => {
    expect(checkedByHook("src/screens/cart/screen.tsx")).toBe(true);
    expect(checkedByHook("src/styles/global.css")).toBe(true);
    expect(checkedByHook("design/flows.json")).toBe(true);
    expect(checkedByHook("../../kit/Button.tsx")).toBe(false);
    expect(checkedByHook("README.md")).toBe(false);
    expect(checkedByHook("../elsewhere/screen.tsx")).toBe(false);
  });

  it("says nothing after a clean edit", () => {
    expect(postEditHook(project, edit("src/screens/cart/screen.tsx"))).toBeUndefined();
    expect(postEditHook(project, edit("vite.config.ts"))).toBeUndefined();
  });

  it("blocks with the problem, the suggestion and advice after a hardcoded color", () => {
    applyOps(root, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: '<Text>Your cart is empty.</Text>', with: '<Text style={{ color: "#2563eb" }}>Your cart is empty.</Text>' }]);
    const out = postEditHook(project, edit("src/screens/cart/screen.tsx"));
    expect(out?.decision).toBe("block");
    expect(out?.reason).toContain("color.brand.600");
    expect(out?.reason).toContain("suggested: var(--kit-color-brand-600)");
    expect(out?.reason).toContain("log a gap with the log_gap tool");
  });

  it("re-exports flows.json when a screen changes, so it never goes stale", () => {
    applyOps(root, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: 'empty: {', with: '"saved-for-later": { data: { cart: emptyCart } },\n    empty: {' }]);
    expect(postEditHook(project, edit("src/screens/cart/screen.tsx"))).toBeUndefined();
    const m = JSON.parse(readFileSync(join(root, "design/flows.json"), "utf8")) as FlowManifest;
    expect(m.screens.find((s) => s.id === "cart")!.states.map((s) => s.id)).toEqual(["default", "saved-for-later", "empty"]);
  });

  it("blocks hand edits to the generated flows.json", () => {
    expect(postEditHook(project, edit("design/flows.json"))).toMatchObject({ decision: "block" });
  });

  it("stays silent outside a Cogitato prototype", async () => {
    expect(await runHook("post-edit", { cwd: join(root, ".."), tool_input: { file_path: join(root, "..", "x.tsx") } })).toBeUndefined();
  });

  it("checks an edit in the second prototype against that prototype", async () => {
    const proto = copyTemplate({ second: true });
    const ws = dirname(dirname(proto));
    try {
      const file = join(ws, "prototypes", "onboarding", "src", "screens", "cart", "screen.tsx");
      writeFileSync(file, readFileSync(file, "utf8").replace('data-kit-id="cart.checkout"', 'data-x="cart.checkout"'));
      const r = await runHook("post-edit", { cwd: ws, tool_input: { file_path: file } });
      expect(r?.decision).toBe("block");
      expect(r?.reason).toMatch(/^Cogitato check of prototypes\/onboarding\/src\/screens\/cart\/screen\.tsx/);
    } finally {
      removeTemplate(proto);
    }
  });

  it("checks the shared contract when it's edited", async () => {
    const proto = copyTemplate({ second: true });
    const ws = dirname(dirname(proto));
    try {
      const file = join(ws, "design", "contract", "tokens.json");
      writeFileSync(file, "{ not json");
      const r = await runHook("post-edit", { cwd: ws, tool_input: { file_path: file } });
      expect(r?.decision).toBe("block");
      expect(r?.reason).toMatch(/design\/contract\/tokens\.json/);
    } finally {
      removeTemplate(proto);
    }
  });
});

describe("session-start hook", () => {
  it("describes every prototype at session start", async () => {
    const proto = copyTemplate({ second: true });
    try {
      const r = await runHook("session-start", { cwd: dirname(dirname(proto)) });
      expect(r?.hookSpecificOutput?.additionalContext).toMatch(/2 prototypes: checkout \(4 screens, 8 states\), onboarding \(4 screens, 8 states\)/);
    } finally {
      removeTemplate(proto);
    }
  });

  it("gives Claude the prototype's shape and flags setup problems for the designer", async () => {
    const out = await sessionStartHook(project.workspace, { offline: true });
    expect(out.systemMessage).toMatch(/^Cogitato: this design workspace isn't ready on this computer yet\. The prototype's parts aren't installed yet/);
    expect(out.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(out.hookSpecificOutput?.additionalContext).toContain("4 screens, 8 states");
    expect(out.hookSpecificOutput?.additionalContext).toContain("setup-machine");
  });
});

describe("saveVersion", () => {
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dirname(dirname(root)), encoding: "utf8" }).stdout.trim();
  const now = new Date("2026-11-02T10:00:00Z");
  beforeEach(() => {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Sam Designer");
    git("config", "user.email", "sam@example.com");
    git("add", "-A");
    git("commit", "-q", "-m", "start");
  });

  it("reports when there's nothing to save", () => {
    expect(saveVersion(project.workspace, { now })).toMatchObject({ saved: false, message: "Nothing new to save: everything is already saved." });
  });

  it("commits on a design branch with a message saying what changed", () => {
    applyOps(root, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: 'empty: {', with: '"saved-for-later": { data: { cart: emptyCart } },\n    empty: {' }]);
    const r = saveVersion(project.workspace, { now });
    expect(r).toMatchObject({ saved: true, branch: "design/sam-designer-20261102", pushed: false, summary: "Add state cart.saved-for-later", issues: [] });
    expect(r.message).toMatch(/^Saved on this computer/);
    expect(git("log", "-1", "--format=%s")).toBe("Add state cart.saved-for-later");
    expect(git("status", "--porcelain")).toBe("");
    // flows.json was exported before committing.
    expect(git("show", "HEAD:prototypes/checkout/design/flows.json")).toContain("saved-for-later");
  });

  it("keeps the designer's own branch, and notes open problems without refusing to save", () => {
    git("switch", "-q", "-c", "design/checkout-ideas");
    writeFileSync(join(root, "src/styles/extra.css"), ".x { color: #123456; }\n");
    const r = saveVersion(project.workspace, { now, message: "Try a darker accent" });
    expect(r).toMatchObject({ saved: true, branch: "design/checkout-ideas", summary: "Try a darker accent" });
    expect(r.issues.map((i) => i.code)).toEqual(["code-hardcoded-color"]);
    expect(r.message).toContain("1 validation problem is still open");
  });

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
});

describe("saveVersion previews on other default branches", () => {
  const g = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8" });
  let ws: string;
  let remote: string;
  /** A two-prototype workspace with hosting set up, pushed to a bare remote on `branch` (no origin/HEAD). */
  const setUp = (branch: string) => {
    ws = dirname(dirname(copyTemplate({ second: true })));
    remote = mkdtempSync(join(tmpdir(), "cogitato-remote-"));
    const pkgPath = join(ws, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    writeFileSync(pkgPath, JSON.stringify({ ...pkg, kit: { previewUrl: "https://{host}.cogitato-preview.app", org: "acme" } }, null, 2));
    g(remote, "init", "-q", "--bare", "-b", branch);
    g(ws, "init", "-q", "-b", branch);
    g(ws, "config", "user.name", "Sam Designer");
    g(ws, "config", "user.email", "sam@example.com");
    g(ws, "add", "-A");
    g(ws, "commit", "-q", "-m", "start");
    g(ws, "remote", "add", "origin", remote);
    g(ws, "push", "-q", "-u", "origin", branch);
  };
  const touch = (rel: string) => writeFileSync(join(ws, rel), readFileSync(join(ws, rel), "utf8") + "\n/* tweak */\n");
  const url = (name: string) => `https://design-sam-designer-20261112--${name}--acme.cogitato-preview.app/__canvas`;
  const now = new Date("2026-11-12T10:00:00Z");
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  });

  it("finds master as the default branch when the remote doesn't name one", () => {
    setUp("master");
    expect(g(ws, "symbolic-ref", "refs/remotes/origin/HEAD").status).not.toBe(0);
    touch("prototypes/onboarding/src/styles/global.css");
    const r = saveVersion(workspaceAt(ws), { now });
    expect(r.pushed).toBe(true);
    expect(r.previews).toEqual([{ prototype: "onboarding", url: url("onboarding") }]);
  });

  it("links every prototype when it can't tell what the branch changed", () => {
    setUp("trunk");
    touch("prototypes/onboarding/src/styles/global.css");
    const r = saveVersion(workspaceAt(ws), { now });
    expect(r.previews.map((p) => p.prototype)).toEqual(["checkout", "onboarding"]);
  });

  it("names several prototypes' changes and ends the list of previews with a full stop", () => {
    setUp("main");
    touch("prototypes/checkout/src/styles/global.css");
    touch("prototypes/onboarding/src/styles/global.css");
    const r = saveVersion(workspaceAt(ws), { now });
    expect(r.summary).toBe("Update the prototypes");
    expect(r.message).toContain(`checkout: ${url("checkout")}; onboarding: ${url("onboarding")}. Version: "Update the prototypes".`);
  });
});

describe("describeChanges", () => {
  it("lists added and removed screens and states", () => {
    const m = (screens: Record<string, string[]>): FlowManifest =>
      ({ schemaVersion: 1, screens: Object.entries(screens).map(([id, states]) => ({ id, route: `/${id}`, title: id, states: states.map((s) => ({ id: s, fixture: s, title: s })) })), flows: [] }) as unknown as FlowManifest;
    expect(describeChanges(m({ cart: ["default", "empty"] }), m({ cart: ["default", "full"], review: ["default"] }))).toEqual([
      "add screen review",
      "add state cart.full",
      "remove state cart.empty",
    ]);
  });
});

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FlowManifest } from "@cogitato/contract";
import { checkedByHook, describeChanges, postEditHook, projectAt, runHook, saveVersion, sessionStartHook, type Project } from "../src/index.js";
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
    expect(checkedByHook("design/contract/tokens.json")).toBe(true);
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
});

describe("session-start hook", () => {
  it("gives Claude the prototype's shape and flags setup problems for the designer", async () => {
    const out = await sessionStartHook(project, { offline: true });
    expect(out.systemMessage).toMatch(/^Cogitato: this prototype isn't ready on this computer yet\. The prototype's parts aren't installed yet/);
    expect(out.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(out.hookSpecificOutput?.additionalContext).toContain("4 screens, 8 states");
    expect(out.hookSpecificOutput?.additionalContext).toContain("setup-machine");
  });
});

describe("saveVersion", () => {
  const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout.trim();
  const now = new Date("2026-11-02T10:00:00Z");
  beforeEach(() => {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Sam Designer");
    git("config", "user.email", "sam@example.com");
    git("add", "-A");
    git("commit", "-q", "-m", "start");
  });

  it("reports when there's nothing to save", () => {
    expect(saveVersion(project, { now })).toMatchObject({ saved: false, message: "Nothing new to save: everything is already saved." });
  });

  it("commits on a design branch with a message saying what changed", () => {
    applyOps(root, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: 'empty: {', with: '"saved-for-later": { data: { cart: emptyCart } },\n    empty: {' }]);
    const r = saveVersion(project, { now });
    expect(r).toMatchObject({ saved: true, branch: "design/sam-designer-20261102", pushed: false, summary: "Add state cart.saved-for-later", issues: [] });
    expect(r.message).toMatch(/^Saved on this computer/);
    expect(git("log", "-1", "--format=%s")).toBe("Add state cart.saved-for-later");
    expect(git("status", "--porcelain")).toBe("");
    // flows.json was exported before committing.
    expect(git("show", "HEAD:design/flows.json")).toContain("saved-for-later");
  });

  it("keeps the designer's own branch, and notes open problems without refusing to save", () => {
    git("switch", "-q", "-c", "design/checkout-ideas");
    writeFileSync(join(root, "src/styles/extra.css"), ".x { color: #123456; }\n");
    const r = saveVersion(project, { now, message: "Try a darker accent" });
    expect(r).toMatchObject({ saved: true, branch: "design/checkout-ideas", summary: "Try a darker accent" });
    expect(r.issues.map((i) => i.code)).toEqual(["code-hardcoded-color"]);
    expect(r.message).toContain("1 validation problem is still open");
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

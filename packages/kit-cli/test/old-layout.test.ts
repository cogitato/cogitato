import { rmSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { KitError, OLD_LAYOUT_MESSAGE, findWorkspace, isOldLayout, resolvePrototype, runHook, sessionStartHook, validateWorkspace, workspaceAt } from "../src/index.js";
import { copyEmptyWorkspace, copyOldLayout, workspaceDir } from "./helpers.js";

let dir: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const run = async (cwd: string, ...argv: string[]) => {
  const out: string[] = [];
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.spyOn(process.stdout, "write").mockImplementation((s) => (out.push(String(s)), true));
  const code = await main(argv);
  vi.restoreAllMocks();
  return { code, out: out.join("") };
};

describe("a repo in the older one-prototype layout", () => {
  it("is recognised, and the template workspace isn't", () => {
    dir = copyOldLayout();
    expect(isOldLayout(workspaceAt(dir))).toBe(true);
    expect(isOldLayout(workspaceAt(workspaceDir))).toBe(false);
  });

  it("gets a clear message instead of a silent pass", () => {
    dir = copyOldLayout();
    const ws = findWorkspace(dir)!;
    expect(OLD_LAYOUT_MESSAGE).toContain("older one-prototype layout");
    expect(() => resolvePrototype(ws)).toThrow(KitError);
    expect(() => resolvePrototype(ws)).toThrow(OLD_LAYOUT_MESSAGE);
    expect(() => resolvePrototype(ws, "checkout")).toThrow(OLD_LAYOUT_MESSAGE);
    expect(() => validateWorkspace(ws)).toThrow(OLD_LAYOUT_MESSAGE);
  });

  it("tells the designer at session start, and tells Claude not to make prototypes/", async () => {
    dir = copyOldLayout();
    const r = await runHook("session-start", { cwd: dir });
    expect(r?.systemMessage).toContain(OLD_LAYOUT_MESSAGE);
    expect(r?.hookSpecificOutput?.additionalContext).toContain(OLD_LAYOUT_MESSAGE);
    expect(r?.hookSpecificOutput?.additionalContext).toMatch(/plain words/);
    expect(r?.hookSpecificOutput?.additionalContext).toMatch(/don't create a prototypes\/ folder/i);
  });

  it("is a problem in kit doctor and kit validate", async () => {
    dir = copyOldLayout();
    const doc = await run(dir, "doctor");
    expect(doc.code).toBe(1);
    expect(doc.out).toContain(OLD_LAYOUT_MESSAGE);
    const val = await run(dir, "validate");
    expect(val.code).toBe(1);
    expect(val.out).toContain(OLD_LAYOUT_MESSAGE);
  });
});

describe("a workspace with no prototypes yet", () => {
  it("validates the contract and kit and says there are no prototypes yet", async () => {
    dir = copyEmptyWorkspace();
    const r = await run(dir, "validate");
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/All good/);
    expect(r.out).toMatch(/design contract and kit are fine/);
    expect(r.out).toMatch(/no prototypes yet/);
  });

  it("says so at session start", async () => {
    dir = copyEmptyWorkspace();
    const out = await sessionStartHook(workspaceAt(dir), { offline: true });
    const context = out.hookSpecificOutput?.additionalContext ?? "";
    expect(context).toMatch(/no prototypes yet/);
    expect(context).not.toMatch(/0 prototypes/);
  });
});

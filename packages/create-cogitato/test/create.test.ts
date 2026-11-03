import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CreateError, createPrototype, packageName } from "../src/create.js";

const pkgDir = fileURLToPath(new URL("..", import.meta.url));
const templateDir = join(pkgDir, "template");
const version = (JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { version: string }).version;

let tmp: string | undefined;
beforeAll(() => {
  execFileSync(process.execPath, [join(pkgDir, "scripts", "bundle-template.mjs")]);
});
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe("the bundled template", () => {
  it("pins every Cogitato package to this release and carries none of our metadata", () => {
    const pkg = JSON.parse(readFileSync(join(templateDir, "package.json"), "utf8")) as Record<string, Record<string, string>>;
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.values(all).some((r) => r.startsWith("workspace:"))).toBe(false);
    expect(all["@cogitato/runtime"]).toBe(`^${version}`);
    expect(all["@cogitato/kit-cli"]).toBe(`^${version}`);
    expect(pkg).not.toHaveProperty("license");
    expect(existsSync(join(templateDir, "node_modules"))).toBe(false);
    expect(existsSync(join(templateDir, "_gitignore"))).toBe(true);
    expect(readFileSync(join(templateDir, "pnpm-workspace.yaml"), "utf8")).toContain("esbuild: true");
    expect(JSON.parse(readFileSync(join(templateDir, "design", "flows.json"), "utf8"))).not.toHaveProperty("commit");
  });
});

describe("createPrototype", () => {
  it("creates a prototype folder named after the folder, with its .gitignore back", () => {
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    const r = createPrototype({ target: join(tmp, "Checkout Ideas"), install: false, git: false });
    expect(r).toMatchObject({ name: "checkout-ideas", installed: false, git: "skipped" });
    for (const f of [".gitignore", ".claude/settings.json", "design/contract/tokens.json", "src/flows.ts", "netlify.toml", "CLAUDE.md"]) {
      expect(existsSync(join(r.dir, f)), f).toBe(true);
    }
    expect((JSON.parse(readFileSync(join(r.dir, "package.json"), "utf8")) as { name: string }).name).toBe("checkout-ideas");
  });

  it("starts git history when asked", () => {
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    const r = createPrototype({ target: join(tmp, "p"), install: false });
    expect(r.git).toBe("committed");
    expect(existsSync(join(r.dir, ".git"))).toBe(true);
  });

  it("refuses a folder that already has files", () => {
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    writeFileSync(join(tmp!, "notes.txt"), "mine");
    expect(() => createPrototype({ target: tmp!, install: false, git: false })).toThrow(CreateError);
  });

  it("makes npm-friendly names", () => {
    expect(packageName("/x/Acme Shop — v2")).toBe("acme-shop-v2");
    expect(packageName("---")).toBe("my-prototype");
  });
});

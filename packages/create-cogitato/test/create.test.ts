import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CreateError, createWorkspace, packageName } from "../src/create.js";

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
  vi.unstubAllEnvs();
});

describe("the bundled template", () => {
  it("pins every Cogitato package to this release and carries none of our metadata", () => {
    const rootPkg = JSON.parse(readFileSync(join(templateDir, "package.json"), "utf8")) as Record<string, Record<string, string>>;
    const protoPkg = JSON.parse(readFileSync(join(templateDir, "prototypes/checkout/package.json"), "utf8")) as Record<string, Record<string, string>>;
    const all = { ...rootPkg.dependencies, ...rootPkg.devDependencies, ...protoPkg.dependencies, ...protoPkg.devDependencies };
    expect(Object.values(all).some((r) => r.startsWith("workspace:"))).toBe(false);
    expect(all["@cogitato/runtime"]).toBe(`^${version}`);
    expect(all["@cogitato/kit-cli"]).toBe(`^${version}`);
    expect(rootPkg).not.toHaveProperty("license");
    expect(protoPkg).not.toHaveProperty("license");
    expect(existsSync(join(templateDir, "node_modules"))).toBe(false);
    expect(existsSync(join(templateDir, "prototypes/checkout/node_modules"))).toBe(false);
    expect(existsSync(join(templateDir, "_gitignore"))).toBe(true);
    expect(readFileSync(join(templateDir, "_pnpm-workspace.yaml"), "utf8")).toContain("esbuild: true");
    expect(JSON.parse(readFileSync(join(templateDir, "prototypes/checkout/design/flows.json"), "utf8"))).not.toHaveProperty("commit");
  });
});

describe("createWorkspace", () => {
  it("creates a workspace named after the folder, with its .gitignore back", () => {
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    const r = createWorkspace({ target: join(tmp, "Checkout Ideas"), install: false, git: false });
    expect(r).toMatchObject({ name: "checkout-ideas", installed: false, git: "skipped" });
    for (const f of [".gitignore", ".claude/settings.json", "design/contract/tokens.json", "kit", "prototypes/checkout/src/flows.ts", "prototypes/checkout/netlify.toml", "CLAUDE.md"]) {
      expect(existsSync(join(r.dir, f)), f).toBe(true);
    }
    expect((JSON.parse(readFileSync(join(r.dir, "package.json"), "utf8")) as { name: string }).name).toBe("checkout-ideas");
  });

  it("creates a workspace with the checkout prototype, pinned and ready for pnpm", () => {
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    const r = createWorkspace({ target: join(tmp, "acme-design"), install: false, git: false, templateDir });
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

  it("starts git history when asked", () => {
    // CI machines have no git identity of their own.
    for (const who of ["AUTHOR", "COMMITTER"]) {
      vi.stubEnv(`GIT_${who}_NAME`, "Test Designer");
      vi.stubEnv(`GIT_${who}_EMAIL`, "designer@example.com");
    }
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    const r = createWorkspace({ target: join(tmp, "p"), install: false });
    expect(r.git).toBe("committed");
    expect(existsSync(join(r.dir, ".git"))).toBe(true);
  });

  it("refuses a folder that already has files", () => {
    tmp = mkdtempSync(join(tmpdir(), "create-cogitato-"));
    writeFileSync(join(tmp!, "notes.txt"), "mine");
    expect(() => createWorkspace({ target: tmp!, install: false, git: false })).toThrow(CreateError);
  });

  it("makes npm-friendly names", () => {
    expect(packageName("/x/Acme Shop — v2")).toBe("acme-shop-v2");
    expect(packageName("---")).toBe("my-design");
  });
});

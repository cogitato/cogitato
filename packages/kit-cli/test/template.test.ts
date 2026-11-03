import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenCssVar, validateFormat, type FlowManifest } from "@cogitato/contract";
import { main } from "../src/cli.js";
import { exportFlows, projectAt, readContract, validate } from "../src/index.js";
import { applyOps, copyTemplate, referenceFlows, templateDir } from "./helpers.js";

const template = projectAt(templateDir);

describe("the template prototype", () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it("validates with no issues", () => {
    expect(validate(template)).toEqual({ ok: true, issues: [] });
  });

  it("has an up-to-date flows.json", () => {
    const r = exportFlows(template, { check: true });
    expect(r.issues).toEqual([]);
    expect(r.changed).toBe(false);
  });

  it("exports the same flows as the Phase 0 reference (apart from commit and review status)", () => {
    const strip = ({ commit: _c, status: _s, $schema: _x, ...rest }: FlowManifest) => rest;
    const reference = JSON.parse(readFileSync(referenceFlows, "utf8")) as FlowManifest;
    expect(strip(exportFlows(template, { check: true }).manifest)).toEqual(strip(reference));
  });

  it("writes flows.json and then reports it as current", () => {
    root = copyTemplate();
    applyOps(root, [{ op: "delete", file: "design/flows.json" }]);
    const p = projectAt(root);
    expect(validate(p).issues.map((i) => i.code)).toEqual(["code-flows-stale"]);
    expect(exportFlows(p).written).toBe(true);
    expect(validate(p)).toEqual({ ok: true, issues: [] });
    expect(validateFormat("flows", JSON.parse(readFileSync(join(root, "design/flows.json"), "utf8"))).ok).toBe(true);
  });

  it("refuses to write flows.json when a flow step is broken", () => {
    root = copyTemplate();
    applyOps(root, [{ op: "replace", file: "src/flows.ts", find: 'to: "checkout.confirmation.default"', with: 'to: "checkout.done.default"' }]);
    const before = readFileSync(join(root, "design/flows.json"), "utf8");
    const r = exportFlows(projectAt(root));
    expect(r.written).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(["code-unknown-flow-step"]);
    expect(readFileSync(join(root, "design/flows.json"), "utf8")).toBe(before);
  });

  it("validates one changed file well under the 2 second budget", () => {
    const file = "src/screens/checkout/payment/screen.tsx";
    validate(template, { files: [file] }); // warm up: schema compile, first parse
    const start = performance.now();
    const r = validate(template, { files: [file] });
    const ms = performance.now() - start;
    expect(r.ok).toBe(true);
    expect(ms).toBeLessThan(1000);
  });

  it("only reports problems in the files it was given", () => {
    root = copyTemplate();
    applyOps(root, [{ op: "replace", file: "src/kit/Card.module.css", find: "background: var(--kit-color-surface-default);", with: "background: #fff;" }]);
    const p = projectAt(root);
    expect(validate(p, { files: ["src/screens/cart/screen.tsx"] }).issues).toEqual([]);
    expect(validate(p, { files: [join(root, "src/kit/Card.module.css")] }).issues.map((i) => i.code)).toEqual(["code-hardcoded-color"]);
  });
});

describe("token variables", () => {
  it("accepts every variable the runtime generates", () => {
    const contract = readContract(template);
    for (const t of contract.tokens) expect(contract.cssVars, t.path).toContain(tokenCssVar(t.path));
    expect(contract.cssVars).toContain("--kit-typography-heading-letter-spacing");
  });
});

describe("kit CLI", () => {
  it("prints a schema-valid report with --json", async () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    const cwd = process.cwd();
    process.chdir(join(templateDir, "src"));
    try {
      expect(await main(["validate", "--json"])).toBe(0);
    } finally {
      process.chdir(cwd);
      vi.restoreAllMocks();
    }
    const report = JSON.parse(written.join(""));
    expect(validateFormat("report", report).ok).toBe(true);
    expect(report).toEqual({ schemaVersion: 1, ok: true, issues: [] });
  });

  it("explains when it's run outside a prototype", async () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    const cwd = process.cwd();
    process.chdir(join(templateDir, "..", ".."));
    try {
      expect(await main(["validate"])).toBe(2);
    } finally {
      process.chdir(cwd);
      vi.restoreAllMocks();
    }
    expect(written.join("")).toMatch(/isn't a Cogitato prototype/);
  });
});

describe("Netlify config", () => {
  // No TOML parser here: these check the lines a preview deploy depends on.
  const configs = {
    template: readFileSync(join(templateDir, "netlify.toml"), "utf8"),
    monorepo: readFileSync(join(templateDir, "..", "..", "netlify.toml"), "utf8"),
  };

  it.each(Object.entries(configs))("%s: serves every route from the app and lets only its own canvas frame it", (_name, toml) => {
    expect(toml).toMatch(/\[\[redirects\]\]\s+from = "\/\*"\s+to = "\/index.html"\s+status = 200/);
    expect(toml).toMatch(/Content-Security-Policy = "frame-ancestors 'self'"/);
    expect(toml).toMatch(/npx playwright install chromium/);
  });

  it("builds the template and everything it depends on from the monorepo", () => {
    expect(configs.monorepo).toMatch(/pnpm --filter @cogitato\/template-prototype-react\.\.\. build/);
    expect(configs.monorepo).toMatch(/publish = "templates\/prototype-react\/dist"/);
    expect(configs.template).toMatch(/publish = "dist"/);
  });
});

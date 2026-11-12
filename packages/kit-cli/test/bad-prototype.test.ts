import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectAt, validate } from "../src/index.js";
import { applyOps, badDir, copyTemplate, type BadCase, removeTemplate } from "./helpers.js";

const cases = readdirSync(badDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(badDir, f), "utf8")) as BadCase] as const);

describe("seeded bad prototypes", () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) removeTemplate(root);
    root = undefined;
  });

  it("has a case for every code rule", () => {
    const codes = new Set(cases.flatMap(([, c]) => c.expect));
    for (const code of [
      "code-hardcoded-color",
      "code-hardcoded-size",
      "code-unknown-token",
      "code-unknown-component",
      "code-missing-kit-id",
      "code-invalid-kit-id",
      "code-duplicate-kit-id",
      "code-missing-default-fixture",
      "code-screen-not-static",
      "code-unknown-flow-step",
      "code-flows-stale",
      "code-invalid-route",
    ]) {
      expect(codes, code).toContain(code);
    }
  });

  it.each(cases)("%s", (_name, c) => {
    root = copyTemplate();
    applyOps(root, c.ops);
    const r = validate(projectAt(root));

    expect([...new Set(r.issues.map((i) => i.code))].sort(), c.description).toEqual([...new Set(c.expect)].sort());
    expect(r.ok).toBe(c.ok ?? false);
    for (const i of r.issues) {
      expect(i.message.length).toBeGreaterThan(20);
      if (i.file.startsWith("src/")) expect(i.line, `${i.code} needs a line number`).toBeGreaterThan(0);
    }
    expect(r.issues.map((i) => `[${i.severity}] ${i.file}${i.line ? `:${i.line}` : ""} ${i.message}${i.suggestion ? ` => ${i.suggestion}` : ""}`)).toMatchSnapshot();
  });
});

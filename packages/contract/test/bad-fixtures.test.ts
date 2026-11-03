import { readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateProject } from "../src/index.js";
import { applyOps, badDir, copyReference, type BadCase } from "./helpers.js";

const cases = readdirSync(badDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(badDir, f), "utf8")) as BadCase] as const);

describe("known-bad fixtures", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dirname(dir), { recursive: true, force: true });
    dir = undefined;
  });

  it("has cases", () => expect(cases.length).toBeGreaterThan(30));

  it.each(cases)("%s", (_name, c) => {
    dir = copyReference();
    applyOps(dir, c.ops);
    const r = validateProject(dir);

    const codes = [...new Set(r.issues.map((i) => i.code))].sort();
    expect(codes, c.description).toEqual([...new Set(c.expect)].sort());
    expect(r.ok).toBe(c.ok ?? false);

    for (const issue of r.issues) {
      expect(issue.file).not.toBe("");
      expect(issue.message.length).toBeGreaterThan(20);
      // Raw Ajv wording ("must have required property ...") isn't designer-readable.
      expect(issue.message).not.toMatch(/^must |instancePath|NOT/);
    }
    // Snapshot the wording so changes to designer-facing copy show up in review.
    expect(r.issues.map((i) => `[${i.severity}] ${i.file} ${i.path}: ${i.message}`)).toMatchSnapshot();
  });
});

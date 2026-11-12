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

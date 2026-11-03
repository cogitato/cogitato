import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateTypes, generatedFile } from "../scripts/gen-lib.js";

describe("generated types", () => {
  it("are up to date with the schemas (run `pnpm gen` if this fails)", async () => {
    expect(readFileSync(generatedFile, "utf8")).toBe(await generateTypes());
  });
});

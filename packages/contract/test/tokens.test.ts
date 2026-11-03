import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTokens, tokenCssVar, tokensToCss, type DesignTokens } from "../src/index.js";
import { referenceDir } from "./helpers.js";

const tokens = JSON.parse(readFileSync(join(referenceDir, "contract/tokens.json"), "utf8")) as DesignTokens;

describe("resolveTokens", () => {
  const byPath = new Map(resolveTokens(tokens).map((t) => [t.path, t]));

  it("follows alias chains to the final value", () => {
    expect(byPath.get("color.text.default")?.resolved).toBe("#0f172a");
    expect(byPath.get("color.feedback.info")?.resolved).toBe("#2563eb");
  });

  it("resolves aliases inside composite values", () => {
    expect(byPath.get("typography.body")?.resolved).toMatchObject({
      fontFamily: ["Inter", "system-ui", "sans-serif"],
      fontSize: { value: 16, unit: "px" },
      fontWeight: 400,
    });
  });

  it("leaves broken aliases as written", () => {
    const broken = { color: { $type: "color", a: { $value: "{color.missing}" } } } as DesignTokens;
    expect(resolveTokens(broken)[0]?.resolved).toBe("{color.missing}");
  });
});

describe("tokensToCss", () => {
  it("names vars from token paths", () => {
    expect(tokenCssVar("color.brand.600")).toBe("--kit-color-brand-600");
  });

  it("writes every token, keeping aliases as var() references", () => {
    expect(tokensToCss(tokens)).toMatchSnapshot();
  });
});

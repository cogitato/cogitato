import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  flattenTokens,
  kebabCase,
  parseNodeRef,
  validateContractDir,
  validateFormat,
  validateProject,
  type DesignTokens,
  type FlowManifest,
} from "../src/index.js";
import { referenceDir } from "./helpers.js";

const readJson = <T>(path: string) => JSON.parse(readFileSync(join(referenceDir, path), "utf8")) as T;

describe("reference project", () => {
  it("validates with no issues", () => {
    expect(validateProject(referenceDir)).toEqual({ ok: true, issues: [] });
  });

  it("validates the contract folder on its own, with file names relative to it", () => {
    expect(validateContractDir(join(referenceDir, "contract"))).toEqual({ ok: true, issues: [] });
  });

  it("matches the flows.json example in interfaces.md", () => {
    const flows = readJson<FlowManifest>("flows.json");
    expect(flows.screens.find((s) => s.id === "checkout.payment")?.states.map((s) => s.id)).toContain("card-declined");
    expect(flows.status?.["checkout.payment.card-declined"]).toBe("in-review");
  });
});

describe("flattenTokens", () => {
  const tokens = flattenTokens(readJson<DesignTokens>("contract/tokens.json"));
  const byPath = new Map(tokens.map((t) => [t.path, t]));

  it("inherits group types", () => {
    expect(byPath.get("space.4")).toMatchObject({ type: "dimension", value: { value: 16, unit: "px" } });
    expect(byPath.get("color.brand.600")).toMatchObject({ type: "color", description: "Brand Blue 600", explicitType: false });
  });

  it("records aliases", () => {
    expect(byPath.get("color.text.default")).toMatchObject({ type: "color", aliasOf: "color.neutral.900" });
  });

  it("does not treat $-keys as tokens", () => {
    expect(tokens.every((t) => !t.path.includes("$"))).toBe(true);
  });
});

describe("helpers", () => {
  it("kebab-cases component names", () => {
    expect(kebabCase("Button")).toBe("button");
    expect(kebabCase("TextField")).toBe("text-field");
    expect(kebabCase("HTMLPreview")).toBe("html-preview");
  });

  it("splits node refs at the last dot", () => {
    expect(parseNodeRef("checkout.payment.card-declined")).toEqual({ screen: "checkout.payment", state: "card-declined" });
    expect(parseNodeRef("cart.default")).toEqual({ screen: "cart", state: "default" });
  });
});

describe("schemaVersion guard", () => {
  const flows = readJson<FlowManifest>("flows.json");

  it("refuses newer versions with one plain-language issue", () => {
    const r = validateFormat("flows", { ...flows, schemaVersion: 2 }, "flows.json");
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.message).toMatch(/Update Cogitato/);
  });

  it("reports a missing version through the schema", () => {
    const { schemaVersion: _v, ...rest } = flows;
    expect(validateFormat("flows", rest).issues.map((i) => i.code)).toEqual(["schema-required"]);
  });
});

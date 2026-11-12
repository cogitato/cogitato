import { describe, expect, it } from "vitest";
import { affectedPrototypes, previewHost } from "../src/hosting.js";

describe("previewHost", () => {
  it("joins branch, prototype and org with double dashes", () => {
    expect(previewHost({ branch: "design/sam-0102", prototype: "checkout", org: "acme-shop-demo" })).toBe(
      "design-sam-0102--checkout--acme-shop-demo",
    );
  });

  it("slugs each part so double dashes only ever separate parts", () => {
    expect(previewHost({ branch: "Feature//New  Flow", prototype: "Check_Out", org: "Acme--Shop" })).toBe(
      "feature-new-flow--check-out--acme-shop",
    );
  });

  it("is deterministic and fits a DNS label when shortened", () => {
    const parts = { branch: `design/${"very-long-branch-name-".repeat(5)}`, prototype: "checkout", org: "acme-shop-demo" };
    const host = previewHost(parts);
    expect(host).toBe(previewHost(parts));
    expect(host.length).toBeLessThanOrEqual(63);
    expect(host).toMatch(/^[a-z0-9-]+--checkout--acme-shop-demo$/);
    expect(host).toMatch(/-[0-9a-f]{6}--checkout--/);
  });

  it("gives different hosts to long branches that share a prefix", () => {
    const long = "design/" + "x".repeat(80);
    const a = previewHost({ branch: `${long}-a`, prototype: "checkout", org: "acme" });
    const b = previewHost({ branch: `${long}-b`, prototype: "checkout", org: "acme" });
    expect(a).not.toBe(b);
  });

  it("shortens the whole label when prototype and org alone are too long", () => {
    const host = previewHost({ branch: "main", prototype: "p".repeat(40), org: "o".repeat(40) });
    expect(host.length).toBeLessThanOrEqual(63);
    expect(host).toMatch(/^[a-z0-9-]+-[0-9a-f]{6}$/);
    expect(host).not.toMatch(/^-|-$/);
  });

  it("names an empty branch or prototype part instead of leaving it blank", () => {
    expect(previewHost({ branch: "///", prototype: "checkout", org: "acme" })).toBe("branch--checkout--acme");
    expect(previewHost({ branch: "main", prototype: "__", org: "acme" })).toBe("main--prototype--acme");
  });

  it("needs an org name", () => {
    expect(() => previewHost({ branch: "main", prototype: "checkout", org: "" })).toThrow("previewHost needs an org name");
    expect(() => previewHost({ branch: "main", prototype: "checkout", org: "--" })).toThrow("previewHost needs an org name");
  });

  it("never starts a label with xn--, which DNS keeps for other scripts", () => {
    const host = previewHost({ branch: "xn", prototype: "checkout", org: "acme" });
    expect(host).toBe("b-xn--checkout--acme");
    expect(host.startsWith("b-xn--")).toBe(true);
  });

  it("keeps a label of exactly 63 characters and shortens one of 64 to 63 with a hash", () => {
    // "--checkout--acme" is 16 characters.
    const fits = previewHost({ branch: "a".repeat(47), prototype: "checkout", org: "acme" });
    expect(fits).toBe(`${"a".repeat(47)}--checkout--acme`);
    expect(fits).toHaveLength(63);
    const over = previewHost({ branch: "a".repeat(48), prototype: "checkout", org: "acme" });
    expect(over).toHaveLength(63);
    expect(over).toMatch(/^a{40}-[0-9a-f]{6}--checkout--acme$/);
  });
});

describe("affectedPrototypes", () => {
  const all = ["checkout", "onboarding"];
  it.each([
    [["prototypes/checkout/src/screens/cart/screen.tsx"], ["checkout"]],
    [["prototypes/onboarding/design/flows.json", "prototypes/checkout/package.json"], ["checkout", "onboarding"]],
    [["design/contract/tokens.json"], all],
    [["kit/Button.tsx"], all],
    [["package.json"], all],
    [["pnpm-lock.yaml"], all],
    [["pnpm-workspace.yaml"], all],
    [["README.md", ".claude/settings.json", ".github/workflows/x.yml"], []],
    [["prototypes/removed/src/a.tsx"], []],
    [[], []],
  ])("%j affects %j", (paths, expected) => {
    expect(affectedPrototypes(paths, all)).toEqual(expected);
  });
});

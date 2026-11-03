import { describe, expect, it } from "vitest";
import { checkCssValue, projectAt, readContract, readScreen } from "../src/index.js";
import { parseSource } from "../src/issue.js";
import { templateDir } from "./helpers.js";

const contract = readContract(projectAt(templateDir));
const check = (prop: string, value: string) => checkCssValue(contract, prop, value);

describe("token rule", () => {
  it("names the palette token for an exact color, as in the kit-cli brief", () => {
    const [f] = check("background", "#2563eb");
    expect(f?.kind).toBe("color");
    expect(f?.message).toContain("color.brand.600 (Brand Blue 600)");
    expect(f?.suggestion).toBe("var(--kit-color-brand-600)");
  });

  it("suggests the closest color when it's off-palette", () => {
    const [f] = check("background-color", "#2462e8");
    expect(f?.message).toMatch(/isn't in the palette. Use color\.brand\.600 \(Brand Blue 600\) instead/);
  });

  it("prefers the semantic token that fits the property", () => {
    expect(check("color", "#0f172a")[0]?.suggestion).toBe("var(--kit-color-text-default)");
    expect(check("background", "#ffffff")[0]?.suggestion).toBe("var(--kit-color-surface-default)");
    expect(check("border-color", "#e2e8f0")[0]?.suggestion).toBe("var(--kit-color-border-default)");
  });

  it("checks colors inside shorthands and functions", () => {
    expect(check("border", "1px solid #e2e8f0").map((f) => f.kind)).toEqual(["color"]);
    expect(check("box-shadow", "0 1px 2px rgba(0, 0, 0, 0.2)").map((f) => f.kind)).toEqual(["color"]);
    expect(check("color", "tomato").map((f) => f.kind)).toEqual(["color"]);
  });

  it("maps sizes onto the right scale", () => {
    expect(check("padding", "16px")[0]?.message).toContain("space.4 on the spacing scale");
    expect(check("margin-top", "15px")[0]?.suggestion).toBe("var(--kit-space-4)");
    expect(check("border-radius", "0.5rem")[0]?.suggestion).toBe("var(--kit-radius-md)");
    expect(check("font-size", "20px")[0]?.suggestion).toBe("var(--kit-font-size-lg)");
  });

  it("allows tokens, zero, keywords, percentages and non-token properties", () => {
    for (const [prop, value] of [
      ["padding", "var(--kit-space-4) var(--kit-space-2)"],
      ["margin", "0 auto"],
      ["background", "transparent"],
      ["color", "currentColor"],
      ["border-left", "4px solid currentColor"],
      ["width", "320px"],
      ["gap", "50%"],
      ["--local", "#fff"],
      ["fontSize", "inherit"],
    ]) {
      expect(check(prop!, value!), `${prop}: ${value}`).toEqual([]);
    }
  });

  it("flags unknown token variables with the closest real one", () => {
    const [f] = check("color", "var(--kit-color-text-defalt)");
    expect(f?.kind).toBe("unknown-token");
    expect(f?.suggestion).toBe("var(--kit-color-text-default)");
  });
});

describe("screen registry", () => {
  const read = (src: string) => readScreen(parseSource("src/screens/x/screen.tsx", src));

  it("reads literal registrations and defaults fixture titles", () => {
    const { screen, issues } = read(`
      export default defineScreen({
        id: "checkout.payment", route: "/checkout/payment", title: "Payment",
        fixtures: { default: { data: {} }, "card-declined": { data: { declined: true } } },
        component: Payment,
      });`);
    expect(issues).toEqual([]);
    expect(screen?.fixtures.map((f) => [f.key, f.title])).toEqual([
      ["default", "Default"],
      ["card-declined", "Card declined"],
    ]);
    expect(screen?.dir).toBe("src/screens/x");
  });

  it("explains computed values in plain language", () => {
    const { issues } = read(`
      const name = "card";
      export default defineScreen({
        id: "checkout.payment", route: "/checkout/payment", title,
        fixtures: { default: { data: {} }, [name]: { data: {} } },
        component: Payment,
      });`);
    expect(issues.map((i) => i.code)).toEqual(["code-screen-not-static", "code-screen-not-static"]);
    expect(issues[0]?.message).toMatch(/plain text/);
  });

  it("asks for a registration when a screen file has none", () => {
    expect(read(`export const x = 1;`).issues.map((i) => i.code)).toEqual(["code-screen-missing"]);
  });
});

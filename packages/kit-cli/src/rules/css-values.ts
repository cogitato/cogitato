import { tokenCssVar, type ResolvedToken } from "@cogitato/contract";
import type { ContractView } from "../project.js";

// Which CSS properties must use tokens, and which token group sizes come from.
const COLOR_PROP =
  /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|fill|stroke|box-shadow|text-shadow|text-decoration(-color)?|caret-color|accent-color|column-rule(-color)?)$/;

const SIZE_GROUPS: { prop: RegExp; group: string; scale: string }[] = [
  { prop: /^(padding|margin)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^(row-|column-)?gap$/, group: "space", scale: "spacing scale" },
  { prop: /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/, group: "radius", scale: "corner radius scale" },
  { prop: /^font-size$/, group: "font.size", scale: "font size scale" },
];

// Named colors designers are likely to type, with values so the nearest token can be suggested.
const NAMED_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", pink: "#ffc0cb", gray: "#808080",
  grey: "#808080", silver: "#c0c0c0", navy: "#000080", teal: "#008080", maroon: "#800000",
  olive: "#808000", lime: "#00ff00", aqua: "#00ffff", cyan: "#00ffff", magenta: "#ff00ff",
  fuchsia: "#ff00ff", brown: "#a52a2a", gold: "#ffd700", indigo: "#4b0082", violet: "#ee82ee",
  coral: "#ff7f50", salmon: "#fa8072", tomato: "#ff6347", crimson: "#dc143c", beige: "#f5f5dc",
  ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa", tan: "#d2b48c", turquoise: "#40e0d0",
  darkgray: "#a9a9a9", darkgrey: "#a9a9a9", lightgray: "#d3d3d3", lightgrey: "#d3d3d3",
  whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc", slategray: "#708090", dimgray: "#696969",
};

const HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const COLOR_FN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)/gi;
const NAMED = new RegExp(`(?<![\\w-])(${Object.keys(NAMED_COLORS).join("|")})(?![\\w-])`, "gi");
const LENGTH = /(?<![\w.-])(-?\d*\.?\d+)(px|rem|em)\b/g;
const VAR = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/** Stands in for a `${...}` substitution when a template literal's text is checked. */
export const SUBSTITUTION = "\u0001";

export type Finding =
  | { kind: "color"; literal: string; message: string; suggestion?: string }
  | { kind: "size"; literal: string; message: string; suggestion?: string }
  | { kind: "unknown-token"; literal: string; message: string; suggestion?: string };

const toKebab = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

type Rgb = [number, number, number];

function parseColor(literal: string): Rgb | undefined {
  const named = NAMED_COLORS[literal.toLowerCase()];
  const value = named ?? literal;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join("") : hex.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return undefined;
}

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Semantic token group that fits a property best, used to break ties between equal colors.
function colorContext(prop: string): string {
  if (prop === "color" || prop.startsWith("text-") || prop === "caret-color") return "color.text.";
  if (prop.startsWith("background")) return "color.surface.";
  if (prop.startsWith("border") || prop.startsWith("outline") || prop.startsWith("column-rule")) return "color.border.";
  return "";
}

function nearestColor(contract: ContractView, rgb: Rgb, prop: string): { token: ResolvedToken; exact: boolean } | undefined {
  const context = colorContext(prop);
  const scored = contract.tokens
    .filter((t) => t.type === "color" && typeof t.resolved === "string")
    .map((t) => ({ t, rgb: parseColor(t.resolved as string) }))
    .filter((x): x is { t: ResolvedToken; rgb: Rgb } => x.rgb !== undefined)
    .map(({ t, rgb: c }) => ({
      t,
      key: [distance(rgb, c), context && t.path.startsWith(context) ? 0 : 1, t.aliasOf ? 1 : 0] as const,
    }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.t.path.localeCompare(b.t.path));
  const best = scored[0];
  return best ? { token: best.t, exact: best.key[0] === 0 } : undefined;
}

function toPx(value: unknown): number | undefined {
  if (typeof value === "string") {
    const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(value);
    return m ? Number(m[1]) * (m[2] === "rem" ? 16 : 1) : undefined;
  }
  if (value && typeof value === "object" && "value" in value && "unit" in value) {
    const v = value as { value: number; unit: string };
    return v.unit === "rem" ? v.value * 16 : v.unit === "px" ? v.value : undefined;
  }
  return undefined;
}

function nearestSize(contract: ContractView, px: number, group: string): { token: ResolvedToken; px: number; exact: boolean } | undefined {
  const best = contract.tokens
    .filter((t) => t.type === "dimension" && t.path.startsWith(`${group}.`))
    .map((t) => ({ t, px: toPx(t.resolved) }))
    .filter((x): x is { t: ResolvedToken; px: number } => x.px !== undefined)
    .sort((a, b) => Math.abs(a.px - px) - Math.abs(b.px - px) || (a.t.aliasOf ? 1 : 0) - (b.t.aliasOf ? 1 : 0))[0];
  return best ? { token: best.t, px: best.px, exact: best.px === px } : undefined;
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

const label = (t: ResolvedToken) => (t.description ? `${t.path} (${t.description})` : t.path);

/**
 * Checks one CSS declaration (or inline style property). `prop` may be camelCase.
 * Token variables, 0, auto, inherit, transparent, currentColor and percentages are fine.
 */
export function checkCssValue(contract: ContractView, rawProp: string, value: string): Finding[] {
  const prop = toKebab(rawProp.trim()).toLowerCase();
  if (prop.startsWith("--")) return [];
  const findings: Finding[] = [];

  for (const m of value.matchAll(VAR)) {
    const name = m[1]!;
    // A name finished by a substitution (`var(--kit-space-${gap})`) is only known at runtime.
    if (value[m.index + m[0].length] === SUBSTITUTION) continue;
    if (!name.startsWith("--kit-") || contract.cssVars.has(name)) continue;
    // Ties go to names of the same length: --kit-color-brand-650 is nearer 600 than 50.
    const closest = [...contract.cssVars].sort(
      (a, b) =>
        levenshtein(name, a) - levenshtein(name, b) ||
        Math.abs(a.length - name.length) - Math.abs(b.length - name.length),
    )[0];
    findings.push({
      kind: "unknown-token",
      literal: name,
      message: `var(${name}) isn't a token in the design system. Check the spelling${closest ? `; did you mean var(${closest})?` : ", or pick an existing token."}`,
      ...(closest ? { suggestion: `var(${closest})` } : {}),
    });
  }

  // Token references are fine; check only what's left once they're removed.
  let rest = value.replaceAll(SUBSTITUTION, " ");
  while (/var\([^()]*\)/.test(rest)) rest = rest.replace(/var\([^()]*\)/g, " ");

  if (COLOR_PROP.test(prop)) {
    const literals = [...rest.matchAll(HEX), ...rest.matchAll(COLOR_FN), ...rest.matchAll(NAMED)].map((m) => m[0]);
    for (const literal of literals) {
      const rgb = parseColor(literal);
      const hit = rgb && nearestColor(contract, rgb, prop);
      const suggestion = hit ? `var(${tokenCssVar(hit.token.path)})` : undefined;
      findings.push({
        kind: "color",
        literal,
        message: !hit
          ? `This color (${literal}) isn't from the palette. Use a color token instead.`
          : hit.exact
            ? `${literal} is ${label(hit.token)} in the palette. Use the token instead of typing the color, so it stays in sync with the design system.`
            : `This color (${literal}) isn't in the palette. Use ${label(hit.token)} instead; it's the closest match.`,
        ...(suggestion ? { suggestion } : {}),
      });
    }
  }

  const size = SIZE_GROUPS.find((g) => g.prop.test(prop));
  if (size) {
    for (const m of rest.matchAll(LENGTH)) {
      const amount = Number(m[1]);
      if (amount === 0) continue;
      const px = amount * (m[2] === "px" ? 1 : 16);
      const hit = nearestSize(contract, px, size.group);
      const suggestion = hit ? `var(${tokenCssVar(hit.token.path)})` : undefined;
      findings.push({
        kind: "size",
        literal: m[0],
        message: !hit
          ? `${m[0]} isn't on the ${size.scale}. Use a ${size.group} token instead.`
          : hit.exact
            ? `${m[0]} is ${hit.token.path} on the ${size.scale}. Use the token instead of typing the size.`
            : `${m[0]} isn't on the ${size.scale}. Use ${hit.token.path} (${hit.px}px) instead; it's the closest size.`,
        ...(suggestion ? { suggestion } : {}),
      });
    }
  }
  return findings;
}

/** A bare number in a React inline style means pixels. */
export function checkCssNumber(contract: ContractView, rawProp: string, n: number): Finding[] {
  if (n === 0) return [];
  const prop = toKebab(rawProp).toLowerCase();
  if (!SIZE_GROUPS.some((g) => g.prop.test(prop))) return [];
  return checkCssValue(contract, prop, `${n}px`);
}

export const FINDING_CODES = {
  color: "code-hardcoded-color",
  size: "code-hardcoded-size",
  "unknown-token": "code-unknown-token",
} as const;

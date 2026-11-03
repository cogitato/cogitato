// No Node imports: this module is the browser-safe `@cogitato/contract/tokens` entry.
import type { DesignTokens, Issue, TokenType } from "./generated/types.js";
import { pointer } from "./pointer.js";

/** A token with its DTCG type inheritance and aliases resolved. */
export interface FlatToken {
  /** Dot path, e.g. "color.brand.600". */
  path: string;
  /** JSON pointer to the token in tokens.json. */
  pointer: string;
  /** Effective type: own $type, else nearest group $type, else the aliased token's type. */
  type: TokenType | undefined;
  /** Value as written; may be an alias like "{color.brand.600}". */
  value: unknown;
  /** Dot path of the token this one aliases, when its whole value is an alias. */
  aliasOf?: string;
  description?: string;
  deprecated?: boolean | string;
  /** True when the token has its own $type rather than an inherited one. */
  explicitType: boolean;
}

const ALIAS = /^\{([^{}]+)\}$/;

export function aliasTarget(value: unknown): string | undefined {
  return typeof value === "string" ? ALIAS.exec(value)?.[1] : undefined;
}

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/** Flattens a DTCG token tree. Aliased tokens without a type of their own take the target's type. */
export function flattenTokens(tokens: DesignTokens): FlatToken[] {
  const out: FlatToken[] = [];
  const walk = (node: Node, path: string[], inherited: TokenType | undefined) => {
    const groupType = (node.$type as TokenType | undefined) ?? inherited;
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$") || !isNode(child)) continue;
      const childPath = [...path, key];
      if ("$value" in child) {
        const own = child.$type as TokenType | undefined;
        out.push({
          path: childPath.join("."),
          pointer: pointer(...childPath),
          type: own ?? groupType,
          value: child.$value,
          aliasOf: aliasTarget(child.$value),
          description: child.$description as string | undefined,
          deprecated: child.$deprecated as boolean | string | undefined,
          explicitType: own !== undefined,
        });
      } else {
        walk(child, childPath, groupType);
      }
    }
  };
  walk(tokens as Node, [], undefined);

  const byPath = new Map(out.map((t) => [t.path, t]));
  const resolveType = (t: FlatToken, seen: Set<string>): TokenType | undefined => {
    if (t.type || !t.aliasOf || seen.has(t.path)) return t.type;
    seen.add(t.path);
    const target = byPath.get(t.aliasOf);
    return target ? resolveType(target, seen) : undefined;
  };
  for (const t of out) t.type = resolveType(t, new Set());
  return out;
}

// Sub-value types for composite tokens. Required fields are marked.
const COMPOSITES: Partial<Record<TokenType, Record<string, { type: TokenType; required: boolean }>>> = {
  typography: {
    fontFamily: { type: "fontFamily", required: true },
    fontSize: { type: "dimension", required: true },
    fontWeight: { type: "fontWeight", required: true },
    lineHeight: { type: "number", required: false },
    letterSpacing: { type: "dimension", required: false },
  },
  shadow: {
    color: { type: "color", required: true },
    offsetX: { type: "dimension", required: true },
    offsetY: { type: "dimension", required: true },
    blur: { type: "dimension", required: true },
    spread: { type: "dimension", required: true },
  },
};

const FONT_WEIGHTS = [
  "thin", "hairline", "extra-light", "ultra-light", "light", "normal", "regular", "book",
  "medium", "semi-bold", "demi-bold", "bold", "extra-bold", "ultra-bold", "black", "heavy",
  "extra-black", "ultra-black",
];

const EXAMPLES: Record<TokenType, string> = {
  color: 'a hex color like "#2563eb"',
  dimension: 'a size like { "value": 16, "unit": "px" } (px or rem)',
  fontFamily: 'a font name like "Inter", or a list like ["Inter", "sans-serif"]',
  fontWeight: "a number from 1 to 1000 (like 400 or 700) or a name like \"bold\"",
  duration: 'a time like { "value": 200, "unit": "ms" } (ms or s)',
  number: "a plain number",
  typography: "a group with fontFamily, fontSize and fontWeight",
  shadow: "a group with color, offsetX, offsetY, blur and spread (or a list of them)",
};

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isSimpleValue(type: TokenType, v: unknown): boolean {
  switch (type) {
    case "color":
      return (
        (typeof v === "string" && /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) ||
        (isNode(v) && typeof v.colorSpace === "string" && Array.isArray(v.components))
      );
    case "dimension":
      return (
        (isNode(v) && isNumber(v.value) && (v.unit === "px" || v.unit === "rem")) ||
        (typeof v === "string" && /^-?\d+(\.\d+)?(px|rem)$/.test(v))
      );
    case "fontFamily":
      return (
        (typeof v === "string" && v.length > 0) ||
        (Array.isArray(v) && v.length > 0 && v.every((f) => typeof f === "string" && f.length > 0))
      );
    case "fontWeight":
      return (isNumber(v) && v >= 1 && v <= 1000) || (typeof v === "string" && FONT_WEIGHTS.includes(v));
    case "duration":
      return (
        (isNode(v) && isNumber(v.value) && v.value >= 0 && (v.unit === "ms" || v.unit === "s")) ||
        (typeof v === "string" && /^\d+(\.\d+)?(ms|s)$/.test(v))
      );
    case "number":
      return isNumber(v);
    default:
      return false;
  }
}

const FILE = "tokens.json";

/** Checks types, values and aliases across all tokens. Structure is checked by the schema. */
export function checkTokens(tokens: DesignTokens, file = FILE): Issue[] {
  const flat = flattenTokens(tokens);
  const byPath = new Map(flat.map((t) => [t.path, t]));
  const groups = new Set<string>();
  for (const t of flat) {
    const parts = t.path.split(".");
    for (let i = 1; i < parts.length; i++) groups.add(parts.slice(0, i).join("."));
  }
  const issues: Issue[] = [];
  const add = (code: string, at: string, message: string) =>
    issues.push({ code, severity: "error", file, path: at, message });

  // Returns the alias's target if it resolves, reporting broken aliases.
  const checkAlias = (from: FlatToken, target: string, at: string): FlatToken | undefined => {
    const hit = byPath.get(target);
    if (hit) return hit;
    add(
      "token-broken-alias",
      at,
      groups.has(target)
        ? `${from.path} points to {${target}}, which is a group of tokens, not a single token. Point it at one token inside the group.`
        : `${from.path} points to {${target}}, which doesn't exist. Check the spelling, or pick an existing token.`,
    );
    return undefined;
  };

  for (const t of flat) {
    const at = t.pointer + "/$value";

    if (t.aliasOf) {
      const target = checkAlias(t, t.aliasOf, at);
      if (!target) continue;
      if (followsCycle(t, byPath)) {
        add("token-alias-cycle", at, `${t.path} points to itself through a chain of aliases. Break the loop by giving one of them a real value.`);
        continue;
      }
      // Stricter than DTCG (which lets an alias take its target's type): an alias whose own or
      // group type disagrees with its target is almost always a mistake.
      if (target.type && target.type !== t.type) {
        add(
          "token-alias-type-mismatch",
          at,
          `${t.path} is a ${t.type} token but points to ${target.path}, which is a ${target.type}. Point it at a ${t.type} token instead.`,
        );
      }
      continue;
    }

    if (!t.type) {
      add(
        "token-missing-type",
        t.pointer,
        `${t.path} has no type. Add "$type" (for example "color" or "dimension") to the token or to the group it's in.`,
      );
      continue;
    }

    const fields = COMPOSITES[t.type];
    if (!fields) {
      if (!isSimpleValue(t.type, t.value)) {
        add("token-invalid-value", at, `${t.path} is a ${t.type} token, so its value should be ${EXAMPLES[t.type]}.`);
      }
      continue;
    }

    const type = t.type;
    const parts = type === "shadow" && Array.isArray(t.value) ? t.value : [t.value];
    parts.forEach((part, index) => {
      const partAt = Array.isArray(t.value) ? `${at}/${index}` : at;
      if (!isNode(part)) {
        add("token-invalid-value", partAt, `${t.path} is a ${type} token, so its value should be ${EXAMPLES[type]}.`);
        return;
      }
      for (const [name, spec] of Object.entries(fields)) {
        const sub = part[name];
        const subAt = `${partAt}/${name}`;
        if (sub === undefined) {
          if (spec.required) add("token-invalid-value", partAt, `${t.path} is missing "${name}". A ${type} token needs ${EXAMPLES[type].replace(/^a group with /, "")}.`);
          continue;
        }
        const subAlias = aliasTarget(sub);
        if (subAlias) {
          const target = checkAlias(t, subAlias, subAt);
          if (target?.type && target.type !== spec.type) {
            add(
              "token-alias-type-mismatch",
              subAt,
              `"${name}" in ${t.path} should point to a ${spec.type} token, but ${target.path} is a ${target.type}.`,
            );
          }
        } else if (!isSimpleValue(spec.type, sub)) {
          add("token-invalid-value", subAt, `"${name}" in ${t.path} should be ${EXAMPLES[spec.type]}.`);
        }
      }
    });
  }
  return issues;
}

function followsCycle(start: FlatToken, byPath: Map<string, FlatToken>): boolean {
  const seen = new Set<string>();
  let current: FlatToken | undefined = start;
  while (current?.aliasOf) {
    if (seen.has(current.path)) return true;
    seen.add(current.path);
    current = byPath.get(current.aliasOf);
  }
  return false;
}

/** A flattened token with every alias in its value replaced by the target's value. */
export interface ResolvedToken extends FlatToken {
  /** The value with aliases followed, including aliases inside composite values. Broken or circular aliases are left as written. */
  resolved: unknown;
}

/** Flattens tokens and resolves aliases. Use on a contract that passed validation. */
export function resolveTokens(tokens: DesignTokens): ResolvedToken[] {
  const flat = flattenTokens(tokens);
  const byPath = new Map(flat.map((t) => [t.path, t]));
  const resolve = (value: unknown, seen: Set<string>): unknown => {
    const target = aliasTarget(value);
    if (target) {
      const hit = byPath.get(target);
      if (!hit || seen.has(target)) return value;
      return resolve(hit.value, new Set([...seen, target]));
    }
    if (Array.isArray(value)) return value.map((v) => resolve(v, seen));
    if (isNode(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, seen)]));
    return value;
  };
  return flat.map((t) => ({ ...t, resolved: resolve(t.value, new Set([t.path])) }));
}

/** CSS custom property for a token: "color.brand.600" -> "--kit-color-brand-600". */
export function tokenCssVar(path: string): string {
  return `--kit-${path.replace(/\./g, "-")}`;
}

const GENERIC_FONTS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif",
  "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong",
]);

const WEIGHT_NUMBERS: Record<string, number> = {
  thin: 100, hairline: 100, "extra-light": 200, "ultra-light": 200, light: 300, normal: 400,
  regular: 400, book: 400, medium: 500, "semi-bold": 600, "demi-bold": 600, bold: 700,
  "extra-bold": 800, "ultra-bold": 800, black: 900, heavy: 900, "extra-black": 950, "ultra-black": 950,
};

// CSS for one (sub)value. Aliases become var() references so the CSS mirrors the token graph.
function cssValue(type: TokenType, value: unknown): string {
  const target = aliasTarget(value);
  if (target) return `var(${tokenCssVar(target)})`;
  switch (type) {
    case "color": {
      if (typeof value === "string") return value;
      const c = value as { colorSpace: string; components: (number | "none")[]; alpha?: number };
      const alpha = c.alpha !== undefined && c.alpha !== 1 ? ` / ${c.alpha}` : "";
      const parts = c.components.join(" ");
      if (c.colorSpace === "hsl" || c.colorSpace === "oklch" || c.colorSpace === "oklab") {
        return `${c.colorSpace}(${parts}${alpha})`;
      }
      return `color(${c.colorSpace} ${parts}${alpha})`;
    }
    case "dimension":
    case "duration":
      return typeof value === "string" ? value : `${(value as { value: number }).value}${(value as { unit: string }).unit}`;
    case "fontFamily":
      return (Array.isArray(value) ? value : [value])
        .map((f: string) => (GENERIC_FONTS.has(f) || /^[A-Za-z-]+$/.test(f) ? f : `"${f}"`))
        .join(", ");
    case "fontWeight":
      return String(typeof value === "string" ? (WEIGHT_NUMBERS[value] ?? value) : value);
    case "number":
      return String(value);
    case "shadow":
      return (Array.isArray(value) ? value : [value])
        .map((s: Record<string, unknown>) =>
          [
            s.inset === true ? "inset" : "",
            cssValue("dimension", s.offsetX),
            cssValue("dimension", s.offsetY),
            cssValue("dimension", s.blur),
            cssValue("dimension", s.spread),
            cssValue("color", s.color),
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(", ");
    case "typography":
      throw new Error("typography is expanded by tokensToCss");
  }
}

/**
 * Turns a valid token tree into CSS custom properties on :root.
 * Typography tokens expand to one var per field plus a `font` shorthand var.
 */
export function tokensToCss(tokens: DesignTokens): string {
  const lines: string[] = [];
  for (const t of flattenTokens(tokens)) {
    if (!t.type) continue;
    const name = tokenCssVar(t.path);
    if (t.type !== "typography" || t.aliasOf) {
      lines.push(`  ${name}: ${cssValue(t.type, t.value)};`);
      continue;
    }
    const v = t.value as Record<string, unknown>;
    const fields = COMPOSITES.typography ?? {};
    const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    for (const [field, spec] of Object.entries(fields)) {
      if (v[field] !== undefined) lines.push(`  ${name}-${kebab(field)}: ${cssValue(spec.type, v[field])};`);
    }
    const lineHeight = v.lineHeight !== undefined ? `/var(${name}-line-height)` : "";
    lines.push(
      `  ${name}: var(${name}-font-weight) var(${name}-font-size)${lineHeight} var(${name}-font-family);`,
    );
  }
  return `/* Generated from tokens.json by @cogitato/contract. Do not edit. */\n:root {\n${lines.join("\n")}\n}\n`;
}

import type { ErrorObject } from "ajv";
import type { Issue, ValidationReport } from "./generated/types.js";
import { describePath } from "./pointer.js";
import { SCHEMA_VERSIONS, getAjv } from "./schemas.js";

export type { Issue, Severity, ValidationReport } from "./generated/types.js";
export { describePath, pointer } from "./pointer.js";

/** A ValidationReport without its schemaVersion: what validator functions return. */
export type ValidationResult = Pick<ValidationReport, "ok" | "issues">;

export function result(issues: Issue[]): ValidationResult {
  return { ok: !issues.some((i) => i.severity === "error"), issues: dedupe(issues) };
}

/** Wraps a result as a versioned report, the form written by `--json`. */
export function toReport(r: ValidationResult): ValidationReport {
  return { schemaVersion: SCHEMA_VERSIONS.report, ...r };
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}|${i.file}|${i.path}|${i.line ?? ""}|${i.column ?? ""}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function quote(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value);
}

function typeName(type: unknown): string {
  const names: Record<string, string> = {
    string: "text",
    number: "a number",
    integer: "a whole number",
    boolean: "true or false",
    object: "a group of fields ({ ... })",
    array: "a list ([ ... ])",
    null: "empty (null)",
  };
  const list = (Array.isArray(type) ? type : [type]).map((t) => names[String(t)] ?? String(t));
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} or ${list.at(-1)}` : (list[0] ?? "");
}

// Values a discriminated oneOf accepts for its tag, read from each branch's const.
function discriminatorValues(e: ErrorObject, schemaId: string): string[] {
  const branches = (e.parentSchema?.oneOf ?? []) as { $ref?: string }[];
  const tag = String((e.params as { tag?: string }).tag);
  return branches.flatMap((branch) => {
    if (!branch.$ref) return [];
    const ref = new URL(branch.$ref, schemaId).href;
    const schema = getAjv().getSchema(ref)?.schema as
      | { properties?: Record<string, { const?: string }> }
      | undefined;
    const value = schema?.properties?.[tag]?.const;
    return value ? [value] : [];
  });
}

/** Converts Ajv errors for one file into designer-readable issues. */
export function fromAjvErrors(errors: ErrorObject[], file: string, schemaId: string): Issue[] {
  // Combinator errors only say "a branch failed"; the branch's own errors are the useful ones.
  // `contains` is the opposite: its per-item errors are noise and the summary is what matters.
  const meaningful = errors.filter(
    (e) => !["if", "oneOf", "anyOf", "allOf"].includes(e.keyword) && !e.schemaPath.includes("/contains/"),
  );
  const list = meaningful.length ? meaningful : errors;
  return list.map((e) => ({
    code: `schema-${e.keyword}`,
    severity: "error" as const,
    file,
    path: e.instancePath,
    message: messageFor(e, schemaId),
  }));
}

function messageFor(e: ErrorObject, schemaId: string): string {
  const where = describePath(e.instancePath);
  const hint = (e.parentSchema as { "x-hint"?: string } | undefined)?.["x-hint"];
  const field = where ? `"${where}"` : "This file";
  const inWhere = where ? ` in "${where}"` : "";
  const withHint = (text: string) => (hint ? `${text} ${hint}` : text);
  const p = e.params as Record<string, unknown>;

  if (e.propertyName !== undefined) {
    return withHint(`The name ${quote(e.propertyName)}${inWhere} isn't allowed.`);
  }
  switch (e.keyword) {
    case "required":
      return `${where ? `"${where}" is` : "This file is"} missing ${quote(p.missingProperty)}.`;
    case "additionalProperties":
      return withHint(
        `${quote(p.additionalProperty)} isn't a field that belongs${inWhere || " here"}. Check the spelling, or remove it.`,
      );
    case "enum":
      return `${field} is ${quote(e.data)}, but it must be one of: ${(p.allowedValues as unknown[]).map(quote).join(", ")}.`;
    case "const":
      return `${field} must be ${quote(p.allowedValue)}.`;
    case "type":
      return `${field} should be ${typeName(p.type)}.`;
    case "pattern":
    case "format":
      return withHint(`${field} is ${quote(e.data)}, which isn't in the right format.`);
    case "minLength":
      return `${field} can't be empty.`;
    case "minItems":
      return withHint(`${field} needs at least ${p.limit} ${p.limit === 1 ? "item" : "items"}.`);
    case "uniqueItems":
      return `${field} lists the same thing twice (items #${Number(p.j) + 1} and #${Number(p.i) + 1}).`;
    case "contains":
      return withHint(`${field} is missing a required entry.`);
    case "minimum":
      return `${field} must be at least ${p.limit}.`;
    case "maximum":
      return `${field} must be at most ${p.limit}.`;
    case "discriminator": {
      const allowed = discriminatorValues(e, schemaId);
      const value = (p as { tagValue?: unknown }).tagValue;
      return value === undefined
        ? `${field} needs a ${quote(p.tag)}.`
        : `${field} has ${quote(p.tag)} set to ${quote(value)}, but it must be one of: ${allowed.map(quote).join(", ")}.`;
    }
    default:
      return withHint(`${field} isn't valid (${e.message ?? e.keyword}).`);
  }
}

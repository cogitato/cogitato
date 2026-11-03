import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compile, type JSONSchema } from "json-schema-to-typescript";

export const schemaDir = fileURLToPath(new URL("../schema/", import.meta.url));
export const generatedFile = fileURLToPath(new URL("../src/generated/types.ts", import.meta.url));

// Root schema files, in the order their types appear in the output.
export const rootSchemas = [
  "contract.schema.json",
  "tokens.schema.json",
  "component.schema.json",
  "decisions.schema.json",
  "gaps.schema.json",
  "flows.schema.json",
  "annotations.schema.json",
  "spec.schema.json",
  "report.schema.json",
  "snapshots.schema.json",
] as const;

const banner = `/* eslint-disable */
/**
 * GENERATED FILE. Do not edit by hand.
 * Source: packages/contract/schema/*.schema.json
 * Regenerate with: pnpm --filter @cogitato/contract gen
 */`;

const allSchemaFiles = ["common.schema.json", ...rootSchemas];

const baseName = (file: string) => file.replace(".schema.json", "");

// Rewrites refs so every definition lives in one root's $defs:
//   "#/$defs/x"                  -> "#/$defs/{file}--x"
//   "other.schema.json#/$defs/x" -> "#/$defs/other--x"
//   "other.schema.json"          -> "#/$defs/other"
function rewriteRefs(node: unknown, file: string): unknown {
  if (Array.isArray(node)) return node.map((n) => rewriteRefs(n, file));
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string") {
      const [target = "", pointer = ""] = value.split("#");
      const owner = target ? baseName(target) : baseName(file);
      const def = pointer.match(/^\/\$defs\/([^/]+)$/)?.[1];
      if (def) out[key] = `#/$defs/${owner}--${def}`;
      else if (!pointer && target) out[key] = `#/$defs/${owner}`;
      else throw new Error(`Unsupported $ref "${value}" in ${file}`);
    } else {
      out[key] = rewriteRefs(value, file);
    }
  }
  return out;
}

// Compiling every schema under one synthetic root makes shared definitions
// (common.schema.json) a single declaration instead of one per file. The merge
// is done here because json-schema-to-typescript's bundler mangles $defs refs
// inside external files.
export async function buildRootSchema(): Promise<JSONSchema> {
  const defs: Record<string, JSONSchema> = {};
  for (const file of allSchemaFiles) {
    const raw = JSON.parse(await readFile(schemaDir + file, "utf8")) as Record<string, unknown>;
    const { $defs, $id: _id, $schema: _schema, ...body } = rewriteRefs(raw, file) as Record<string, unknown>;
    for (const [name, def] of Object.entries(($defs ?? {}) as Record<string, JSONSchema>)) {
      defs[`${baseName(file)}--${name}`] = def;
    }
    if (file !== "common.schema.json") defs[baseName(file)] = body as JSONSchema;
  }
  const properties: Record<string, JSONSchema> = {};
  for (const file of rootSchemas) properties[baseName(file)] = { $ref: `#/$defs/${baseName(file)}` };
  return {
    title: "KitSchemas",
    description: "Index of every Cogitato format. Not a file format itself.",
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    $defs: defs,
  };
}

export async function generateTypes(): Promise<string> {
  const root = await buildRootSchema();
  return compile(root, "KitSchemas", {
    cwd: schemaDir,
    bannerComment: banner,
    additionalProperties: false,
    strictIndexSignatures: true,
    style: { singleQuote: false, semi: true, printWidth: 100 },
  });
}

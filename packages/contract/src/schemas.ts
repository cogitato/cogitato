import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

export const SCHEMA_BASE = "https://kit.local/schema/";

/** Schema file for each file format. */
export const formatSchemas = {
  contract: "contract.schema.json",
  tokens: "tokens.schema.json",
  component: "component.schema.json",
  decisions: "decisions.schema.json",
  gaps: "gaps.schema.json",
  flows: "flows.schema.json",
  annotations: "annotations.schema.json",
  spec: "spec.schema.json",
  report: "report.schema.json",
  snapshots: "snapshots.schema.json",
} as const;

export type FormatName = keyof typeof formatSchemas;

/**
 * Highest schemaVersion this package understands, per versioned format.
 * The contract's version covers every file in design/contract/.
 */
export const SCHEMA_VERSIONS = {
  contract: 1,
  flows: 1,
  annotations: 1,
  spec: 1,
  report: 1,
  snapshots: 1,
} as const;

export type VersionedFormat = keyof typeof SCHEMA_VERSIONS;

const schemaDir = new URL("../schema/", import.meta.url);

/** Reads a schema file from packages/contract/schema/. */
export function readSchema(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(file, schemaDir), "utf8")) as Record<string, unknown>;
}

export type Ajv = InstanceType<typeof Ajv2020.default>;

let ajv: Ajv | undefined;

export function getAjv(): Ajv {
  if (ajv) return ajv;
  ajv = new Ajv2020.default({
    allErrors: true,
    strict: true,
    verbose: true,
    discriminator: true,
    allowUnionTypes: true,
  });
  addFormats.default(ajv);
  // Annotation keywords: x-hint feeds designer-facing messages, tsType feeds type generation.
  ajv.addKeyword({ keyword: "x-hint", schemaType: "string" });
  ajv.addKeyword({ keyword: "tsType", schemaType: "string" });
  ajv.addSchema(readSchema("common.schema.json"));
  for (const file of Object.values(formatSchemas)) ajv.addSchema(readSchema(file));
  return ajv;
}

export function getValidator(format: FormatName): ValidateFunction {
  const validate = getAjv().getSchema(SCHEMA_BASE + formatSchemas[format]);
  if (!validate) throw new Error(`Schema for "${format}" is not registered`);
  return validate;
}

# ADR 002: Schema tooling, and v1 answers to the open contract questions

- **Status:** Accepted
- **Date:** 2026-11-01

## Context
CLAUDE.md requires JSON Schema as the source of truth, with types generated from it rather than written by hand. Phase 0 needed a validator, a type generator, and answers to the two open questions in [01-contract.md](../architecture/components/01-contract.md).

## Decision

### Tooling
- **JSON Schema draft 2020-12**, one file per format in `packages/contract/schema/`. Shared ids live in `common.schema.json` and are referenced as `common.schema.json#/$defs/...`.
- **Ajv 8** (`ajv/dist/2020`) in strict mode, plus `ajv-formats`. Strict mode catches schema typos; schemas declare every `required` key in the same object to satisfy it.
- **json-schema-to-typescript** generates `src/generated/types.ts`. Its ref bundler mishandles `$defs` refs inside external files, so `scripts/gen-lib.ts` merges every schema into one in-memory root before compiling. Shared types are then emitted once. The generated file is committed, and a test fails if it's out of date.
- Two custom annotation keywords are registered with Ajv: `x-hint` (plain-language help appended to validation messages) and `tsType` (a type-generation override).

### Validation output
Every issue has a stable `code`, a `severity`, a `file`, a JSON-pointer `path`, and a plain-language `message`. Schema errors are translated from Ajv's wording (`schema-<keyword>`); checks a schema can't express have their own codes (`token-broken-alias`, `flows-unknown-node`, and so on). Warnings don't fail validation.

### Versioning
`schemaVersion` lives in `contract.json` (covering the whole contract folder), `flows.json`, annotation exports, and `spec.json`. The validator checks it **before** running the schema. A newer version gets one "update Cogitato" message; an older one gets "migration needed". Today every format is version 1.

### v1 answers to open contract questions
- **Composition (slots/children):** modeled as props only. Content slots are props of type `node`; callbacks are props of type `event`. Prop types: `enum`, `boolean`, `string`, `number`, `node`, `event`.
- **Prop detail for generated vs production components:** the same schema applies to both. `confidence` carries the uncertainty; we don't vary the required detail by `source`.

### Format refinements made while writing the schemas
- Annotations are exported as `{ schemaVersion, exportedAt, annotations: [...] }`, so the file has a version. `anchor.kitId` is optional (a comment can be pinned to a spot); `fallbackRect` is required so every comment stays placeable.
- Screen ids may have a single segment (`cart`). Element ids (`kitId`) and flow nodes need at least two (`cart.checkout`, `cart.default`).
- In `spec.json`, `modified` components need `changes` and `new` components need a `reason`.

## Consequences
- Every package imports types and validators from `@cogitato/contract`; nobody re-declares a format.
- kit-cli (Phase 1) wraps `validateProject` / `validateContractDir`. It doesn't reimplement them.
- `DesignTokens` is typed loosely (children are `unknown`) because DTCG type inheritance can't be typed statically. Code should read tokens through `flattenTokens()`, which returns resolved types.

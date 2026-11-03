# @cogitato/contract

JSON Schemas, generated TypeScript types, and validators for every Cogitato shared format ([interfaces.md](../../docs/architecture/interfaces.md)).

| Format | File in a prototype repo | Schema |
|---|---|---|
| Contract metadata | `design/contract/contract.json` | `schema/contract.schema.json` |
| Tokens (DTCG) | `design/contract/tokens.json` | `schema/tokens.schema.json` |
| Component manifest | `design/contract/components/{name}.json` | `schema/component.schema.json` |
| Decision log | `design/contract/decisions.json` | `schema/decisions.schema.json` |
| Gap log | `design/contract/gaps.json` | `schema/gaps.schema.json` |
| Flow manifest | `design/flows.json` | `schema/flows.schema.json` |
| Annotation export | `design/annotations/{name}.json` | `schema/annotations.schema.json` |
| Handoff spec | `design/handoff/{initiative}/spec.json` | `schema/spec.schema.json` |

## Use
```ts
import { validateProject, type FlowManifest } from "@cogitato/contract";

const { ok, issues } = validateProject("path/to/prototype/design");
for (const i of issues) console.log(`${i.file}: ${i.message}`);
```
Other entry points: `validateContractDir`, `validateFlows`, `validateAnnotations`, `validateSpec`, `validateFormat`, and `flattenTokens` (tokens with inherited types and aliases resolved).

Each issue has a stable `code`, a `severity`, a `file`, a JSON-pointer `path`, and a `message` written for designers.

## Develop
```
pnpm gen        # regenerate src/generated/types.ts from the schemas
pnpm test       # reference contract passes; every fixtures/bad case fails as expected
```
- Change a schema, then run `pnpm gen` and commit the generated file (a test checks it's current).
- Add a known-bad case as `fixtures/bad/<name>.json`: the edits to apply to the reference project, and the issue codes they must produce. Message wording is snapshotted in `test/__snapshots__/`.
- Decisions behind the formats: [ADR 001](../../docs/decisions/001-token-format-dtcg.md), [ADR 002](../../docs/decisions/002-schema-tooling.md).

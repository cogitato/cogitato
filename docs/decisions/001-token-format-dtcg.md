# ADR 001: Token format is W3C DTCG

- **Status:** Accepted
- **Date:** 2026-11-01
- **Resolves:** open decision #2

## Context
Every downstream component reads tokens from the contract: the validator (is this value a token?), the template (token CSS), the kit preview, and intake (which must convert whatever a team has). Options were the W3C Design Tokens Community Group (DTCG) format, Style Dictionary's legacy format, or a custom format.

## Decision
`design/contract/tokens.json` uses a **subset of DTCG**:

- Tokens are objects with `$value`, plus optional `$type`, `$description`, `$deprecated` and `$extensions`. Groups are any other object. `$type` on a group is inherited by its tokens.
- Supported types: `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `number`, `typography`, `shadow`.
- Aliases are written `"{group.token}"`, either as a whole value or inside composite values.
- `dimension` and `duration` accept both the current object form (`{ "value": 16, "unit": "px" }`) and the older string form (`"16px"`). `color` accepts hex strings or a `{ colorSpace, components }` object.

The schema checks structure. The validator (`checkTokens`) checks types, values and aliases, because type inheritance can't be expressed in JSON Schema.

**One deliberate deviation:** an alias whose own or inherited type differs from its target's type is an error. DTCG would let the alias take the target's type. In a contract that's almost always a mistake (a color group pointing at a spacing token).

## Consequences
- Style Dictionary and other DTCG tooling can read the file directly to emit CSS variables for the template.
- Intake adapters produce DTCG, which makes it the shared target format.
- Types outside the subset (`cubicBezier`, `gradient`, `border`, `transition`, `strokeStyle`) are rejected for now. Adding one means updating the schema enum and adding a value check, which is a minor change, not a `schemaVersion` bump.

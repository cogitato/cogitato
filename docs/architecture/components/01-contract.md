# 01 · Design Contract Schema

**Package:** `packages/contract`  ·  **Phase:** 0

## Responsibility
Define and validate the design contract: tokens, component manifests, rules, decisions, gaps. See [interfaces.md §1](../interfaces.md#1-design-contract--cogitatocontract).

## Deliverables
- JSON Schemas for `contract.json`, component manifests, `decisions.json`, `gaps.json`
- Token format: W3C Design Tokens Community Group (DTCG) JSON
- TypeScript types generated from the schemas, shared by every other package
- A hand-written **reference contract** for a sample product, used to test everything else before intake exists

## Key decisions
- Token format: DTCG (tooling like Style Dictionary can output CSS variables from it).
- One file per component, so diffs and reviews stay small.
- `source` + `confidence` on every component, surfaced as badges in the UI.

## Open questions
- How much prop detail is required for `generated` components vs `production` ones?
- Do we model component composition (slots/children) in v1, or only props?

## Done when
- Schemas validate the reference contract and reject a set of known-bad fixtures.
- Types are published and imported by kit-cli.

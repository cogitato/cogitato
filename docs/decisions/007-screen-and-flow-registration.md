# ADR 007: Screens and flows are registered in code and read statically

- **Status:** Accepted
- **Date:** 2026-11-02
- **Resolves:** open decision #4

## Decision
- **One folder per screen** under `src/screens/`, each with a `screen.tsx` that default-exports `defineScreen({ id, route, title, fixtures, component })`. Files inside a screen's folder belong to that screen. That's how the validator knows which `data-kit-id` prefix they need.
- **Fixtures are the states.** Each is `{ title?, data }`. The key is the state id (`card-declined`), and the title defaults to the humanized key ("Card declined"). Every screen needs a `default` fixture.
- **Flow edges live in a separate `src/flows.ts`:** `defineFlows([{ id, title, edges: [{ from, to, label? }], nodes? }])`. Edges connect states, so they don't belong to any one screen. Steps default to the edge endpoints in order of first mention.
- **`kit export-flows` never runs prototype code.** It parses `screen.tsx` and `flows.ts` with the TypeScript parser (no type checker), which keeps it fast and deterministic. The catch is that ids, routes, titles, fixture names and fixture titles must be written as plain text. The validator explains this in plain language (`code-screen-not-static`). Fixture `data` can be anything.
- **`flows.json` layout:** screens are ordered by their first appearance in a flow, so the canvas reads left to right; screens in no flow come after, by id. The file is committed. `kit validate` warns (`code-flows-stale`) when it no longer matches the code, ignoring `commit`.
- **Review status** (`status` in `flows.json`) isn't written by `export-flows` in Phase 1. The canvas will own it from Phase 3, and its storage gets decided then. If it becomes a file, it needs a schema like every other format.
- **When a screen file can't be read,** flow-step checks are skipped. Otherwise they'd only repeat the real problem as "unknown step" errors.

## Consequences
- A designer prompt like "add the card-declined state" becomes one new key in `fixtures`, plus optionally an edge in `flows.ts`. `kit validate` confirms both, and `kit export-flows` puts it in `flows.json`.
- Computed screen ids or generated screens aren't supported. If that's ever needed, the alternative was loading screens through Vite's module loader, which is slower and runs code.

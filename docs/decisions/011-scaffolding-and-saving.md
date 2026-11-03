# ADR 011: Scaffolding writes code; saving hides git

- **Status:** Accepted
- **Date:** 2026-11-02
- **Resolves:** the 05-kit-mcp open question on `create_screen`

## Decision
- **The `create_screen` / `kit new-screen` skeleton:**
  - Writes `src/screens/<id with dots as folders>/screen.tsx`.
  - Includes a `defineScreen` with literal id, route, title and a `default` state, and a bare `<main><h1>` component.
  - Claude then fills in the UI with kit components.
  - The skeleton uses no kit components itself, so it works with any contract.
- **`add_state` / `kit add-state`** inserts `"<state>": { title, data: {} }` into the screen's `fixtures` object.
- **`kit add-edge`** inserts `{ from, to, label }` into the right flow in `src/flows.ts`. That's the flow that already contains `from`, or the one named. If needed, it creates the flow or the file.
- **How edits are made:** found with the TypeScript parser and made as text insertions at those positions, matching the surrounding layout (one per line, or inline). Comments and formatting elsewhere are untouched.
- **Afterwards:** every scaffolding call exports `flows.json`, validates the touched files, and returns the state's local link (`http://localhost:5173/<route>?fixture=<state>`) until the canvas exists.
- **`log_gap` / `kit gap add`:**
  - Appends to `design/contract/gaps.json`, checked against `gaps.schema.json`.
  - The id is `gap_<slug>`, with a suffix if it's already taken.
  - An open gap with the same kind and name is returned instead of duplicated.
- **`save_version` / `kit save`:**
  1. Exports flows and commits everything.
  2. On `main`/`master`, it first switches to `design/<git user>-<yyyymmdd>`.
  3. The commit message comes from the `flows.json` diff ("Add screen checkout.review; add state checkout.payment.card-expired"). A `flows.json` whose only change is its `commit` field doesn't count as a change.
  4. It pushes when there's a remote.
  5. Validation errors don't block the save, but they're reported.

## Why
- Claude reliably writes UI, but less reliably remembers every registration detail (literal ids, default state, flow edges, `flows.json`). Deterministic scaffolding removes those failure modes.
- Designers think in versions, not commits. A design branch keeps their work off `main` until a developer reviews it.

## Consequences
- The kit MCP server has a ninth tool, `save_version`, which only the `save-version` skill uses. That skill can't be invoked by the model on its own (`disable-model-invocation`).
- Preview links for saved versions come with hosting in Phase 3.

# 09 · Handoff Generator + Implement Skill

**Package:** `packages/handoff` + skills `prepare-handoff`, `implement-handoff`  ·  **Phase:** 6

## Responsibility
Produce a spec a developer's Claude Code can build from, not a code dump. Format in [interfaces.md §5](../interfaces.md#5-handoff-spec--cogitatohandoffinitiativespecmd--specjson).

## prepare-handoff (designer side)
1. Asks for intent and acceptance criteria in plain language (or drafts them for approval).
2. Reads `flows.json` → flow map and state inventory with canvas links.
3. Scans code → component usage split into reused / modified / new.
4. Pulls annotations from the comment service → resolved intent/spec/questions; open questions listed.
5. Writes `spec.md` + `spec.json`, opens a PR.

## implement-handoff (developer side, in the production repo)
1. Reads spec + contract `mapping`.
2. Maps each prototype component to its production counterpart; lists the new ones as build work.
3. Proposes an implementation plan, then builds, treating prototype code as reference for layout/markup only.

## Open questions
- How do we guarantee "modified" components are detected? (Diff of props used vs contract, plus local overrides.)

## Done when
- A developer can run implement-handoff on a sample spec and get a plan that names real production files.

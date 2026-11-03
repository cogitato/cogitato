# Cogitato — notes for Claude Code

Read `docs/architecture/overview.md` and `docs/architecture/interfaces.md` before changing anything.

## Ground rules
- The formats in `interfaces.md` are contracts between packages. Don't change one without updating its schema, its `schemaVersion`, and every consumer.
- Keep deterministic logic in `packages/kit-cli`. Skills, hooks and the MCP server call into it; they don't reimplement it.
- Every user-facing message from the validator, hooks or skills must be understandable by a non-technical designer.
- Work phase by phase per `docs/roadmap.md`. Don't build intake or handoff before the Phase 1–3 loop works.
- Record decisions as ADRs in `docs/decisions/`.
- Verify Claude Code plugin, hook and MCP specifics against current docs; they change.

## Conventions
- TypeScript, pnpm workspaces
- The brand name (Cogitato) appears only at the edges: npm scope, plugin name, prose. Internal names stay brand-free (`design/`, `--kit-`, `kit:`, `/__kit-data/`), per ADR 016.
- Changes that should reach npm need a changeset (`pnpm changeset`).
- Schemas are JSON Schema; types are generated from them, never hand-written

# ADR 006: kit CLI ships as a pinned devDependency

- **Status:** Accepted
- **Date:** 2026-11-02
- **Resolves:** open decision #3

## Decision
- `@cogitato/kit-cli` (bin `kit`) is a **devDependency of each prototype repo**, pinned to an exact version in the template. Inside this monorepo the template uses `workspace:*`.
- It is **library-first**:
  - `validate`, `exportFlows`, `doctor` and `preview` are exported functions.
  - `src/cli.ts` is a thin `mri` parser over them.
  - Hooks and the kit MCP server (Phase 2) import the library or call the CLI. They don't reimplement it (CLAUDE.md).
- Machine output is a **`ValidationReport`** (`report.schema.json`, ADR 008) via `--json`. Exit codes are 0 for ok, 1 for problems, and 2 when it couldn't run.

## Why not bundle it in the plugin
A version pinned in the prototype repo means everyone working on that prototype (designer, developer, CI, Netlify build) validates with the same rules. A plugin-bundled binary would drift with whatever plugin version each person has installed.

## Consequences
- The template's `dev` script is `kit export-flows && vite`, and `build` is `kit validate && kit export-flows && tsc --noEmit && vite build`.
- Upgrading the rules is a dependency bump in the prototype repo, reviewed like any other change.

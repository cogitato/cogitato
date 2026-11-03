# ADR 004: pnpm workspaces monorepo, TypeScript, ESM

- **Status:** Accepted
- **Date:** 2026-11-01

## Decision
- **pnpm workspaces** covering `packages/*`, `apps/*` and `templates/*`. Root scripts `gen`, `build`, `typecheck` and `test` run in every package (`pnpm -r`).
- **Node 22+**, pinned in `.nvmrc` and `engines`.
- **TypeScript**, strict, with `noUncheckedIndexedAccess`, `module`/`moduleResolution: NodeNext`, ESM only (`"type": "module"`). Shared options are in `tsconfig.base.json`.
- **vitest** for tests.
- pnpm blocks dependency install scripts by default. `esbuild` (used by tsx and vitest) is allowed in `pnpm-workspace.yaml` under `allowBuilds`.
- Packages are only created when their phase starts. Phase 0 has just `packages/contract`.

## Consequences
- Each package publishes `dist/` and depends on `@cogitato/contract` via `workspace:*`.
- ESM with NodeNext means relative imports carry `.js` extensions, and CommonJS dependencies like Ajv are reached through `.default`.

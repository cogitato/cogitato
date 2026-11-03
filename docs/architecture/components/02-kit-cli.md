# 02 · Kit CLI

**Package:** `packages/kit-cli` (`kit` command)  ·  **Phase:** 1

## Responsibility
The deterministic engine. Everything that must behave the same no matter what the AI does goes here. Hooks, skills and the MCP server all call into it.

## Commands
| Command | What it does |
|---|---|
| `kit validate [--contract] [--files ...]` | Validate contract against schema; validate prototype code against contract |
| `kit preview` | Serve the kit preview page (every token and component, with badges) |
| `kit export-flows` | Write `design/flows.json` from the route + fixture registry |
| `kit doctor` | Machine health check: Node version, deps installed, servers running, env vars present |
| `kit gap add` | Append to `gaps.json` |
| `kit spec` | Assemble handoff spec (used by handoff package) |

## Validation rules (v1)
- No hardcoded colors, font sizes, spacing or radii; tokens only
- Only components listed in the contract may be imported from the kit
- Every route has a registered `default` fixture
- Interactive elements carry `data-kit-id`
- Fixture ids referenced in flows exist

Implementation: AST checks (TypeScript compiler API or Babel) plus a stylelint-style pass on CSS. Output both machine-readable JSON and **plain-language messages** for designers:
> "This color isn't in the palette. Use `color.brand.600` (Brand Blue 600) instead."

## Open questions
- Ship as an npm package installed in each prototype repo, or as a binary bundled with the plugin? (Leaning: npm devDependency, pinned version in template.)

## Done when
- `kit validate` catches each rule on a seeded bad prototype, with designer-readable output, in under 2 seconds on a typical edit.

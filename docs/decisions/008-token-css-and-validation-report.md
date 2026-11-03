# ADR 008: Token CSS naming, and the validation report format

- **Status:** Accepted
- **Date:** 2026-11-02

## Token CSS
`tokensToCss` (in `@cogitato/contract`) is the single definition, used by both the runtime's Vite plugin and kit-cli's validator.

- **Naming:** a token at `color.brand.600` becomes `--kit-color-brand-600`. The name is `--kit-` plus the dotted path with dots replaced by dashes.
- **Aliases** become `var()` references (`--kit-color-text-default: var(--kit-color-neutral-900)`), so the CSS mirrors the token graph.
- **Values:** dimensions and durations as written (`16px`, `200ms`). Font weights as numbers. Font families as CSS lists. Shadows as a `box-shadow` string.
- **Typography** expands to `-font-family`, `-font-size`, `-font-weight`, `-line-height` and `-letter-spacing` variables, plus a shorthand variable usable as `font: var(--kit-typography-body)`.
- **The validator accepts exactly the variables `tokensToCss` emits.** It reads them from the generated CSS rather than re-deriving the names, so the two can't disagree.

## Validation report
`schema/report.schema.json` defines `ValidationReport { schemaVersion, ok, issues[] }`. Each issue has:
- `code` and `severity`
- `file` and `path`: JSON pointer for JSON files, `""` for source files
- `line` and `column` for source files
- `message`, written for designers
- an optional machine `suggestion`, e.g. `var(--kit-color-brand-600)` or a suggested `data-kit-id`

It's the output of `kit validate --json` and `kit export-flows --json`, read by hooks and the MCP server in Phase 2. `Issue` and `ValidationReport` are generated from this schema, like every other format type.

## Code rules (v1)
| Code | What it catches |
|---|---|
| `code-hardcoded-color` / `code-hardcoded-size` / `code-unknown-token` | Typed colors and sizes, or a `--kit-` variable that doesn't exist. Checks CSS files and inline `style={{}}`. Suggests the nearest token: colors by RGB distance, with ties going to the semantic group that fits the property (`color` → `color.text.*`); sizes within the property's scale (space, radius, font.size). Width and height are layout and aren't checked. |
| `code-unknown-component` | An import from `@/kit/` of a component the contract doesn't list. |
| `code-missing-kit-id` / `code-invalid-kit-id` / `code-duplicate-kit-id` / `code-kit-id-unchecked` (warning) | Interactive elements need a `data-kit-id`: native controls, anything with an `on*` handler, and kit components whose manifest has an `event` prop. The id must match the shared pattern and start with the owning screen's id. Computed ids get a warning. `src/kit/` is exempt (kit components pass ids through). |
| `code-missing-default-fixture`, `code-screen-not-static`, `code-invalid-*`, `code-duplicate-screen` | Screen registration. |
| `code-unknown-flow-step`, `code-flows-not-static`, `code-flows-stale` (warning) | Flows. |

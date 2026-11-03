# 06 · Intake Pipeline + Decision Review

**Package:** `packages/intake` + `plugin/skills/intake`  ·  **Phase:** 5

## Responsibility
Turn whatever a team has into a validated contract and a new prototype repo. "Come as you are."

## Source adapters
| Adapter | Input | Extracts |
|---|---|---|
| Code | Local repo path | Tokens (CSS vars, theme files, Tailwind config), components + props, usage counts |
| Figma | Connection, or exported variables JSON, or screenshots | Variables → tokens, components + variants |
| Docs | PDFs, docs, images in `sources/` | Colors, type, spacing, rules (low confidence) |

Adapters output a common **candidate** format. Claude (via the `contract-auditor` agent) does the judgment work: clustering near-duplicates, proposing canonical versions, writing rules.

## Reconciliation
Conflicts between sources become **decisions**, never silent picks. Each has options, evidence and a recommendation.

## Decision review page
Local web page (served by kit-cli) showing each decision visually: swatches, components side by side. Developer picks; answers go to `decisions.json`. Re-runs reuse past answers and show only diffs.

## Starting-point paths (from the concept doc)
1. Mature design system in code → import and wrap
2. Legacy code → audit, cluster, canonicalize, wrap chosen versions
3. Figma only → generate coded components named 1:1
4. Brand docs only → extract tokens, generate starter kit

## Open questions
- Build order across paths: start with (1) and (4)? They're the simplest and the most different from each other.
- Figma access in v1: official Figma MCP/connector if available, else exported JSON.

## Done when
- For a sample repo and a sample brand PDF, intake produces a contract that passes validation and a kit preview a designer signs off on.

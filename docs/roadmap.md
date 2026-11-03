# Roadmap

The order is chosen to prove the core loop (designer builds → everyone reviews on the canvas → developer receives a spec) with a **hand-written contract** first. Intake is the most variable and complex piece, so it comes after the loop works.

Pick one **pilot product** with a known design system to use throughout Phases 1–4.

## Phase 0 — Interfaces (1–2 weeks)
- Contract JSON Schemas + reference contract for the pilot ([01](architecture/components/01-contract.md))
- `flows.json`, anchor convention, annotation model, spec format ([interfaces.md](architecture/interfaces.md))
- Monorepo setup

**Exit:** schemas validate the reference contract; types shared across packages.

## Phase 1 — Build and validate locally (2–3 weeks)
- Prototype template with fixture system and frame mode ([03](architecture/components/03-prototype-template.md))
- Kit CLI: `validate`, `export-flows`, `preview`, `doctor` ([02](architecture/components/02-kit-cli.md))

**Exit:** a developer can hand-build a 3-screen flow with states; `kit validate` catches violations; `flows.json` is correct.

## Phase 2 — Designer in Claude Code (2–3 weeks)
- Plugin: hooks + `setup-machine`, `new-screen`, `add-state`, `save-version` ([04](architecture/components/04-claude-plugin.md))
- Kit MCP server ([05](architecture/components/05-kit-mcp.md))

**Exit:** a designer with no terminal use builds a validated flow from plain-language prompts. **First real designer test.**

## Phase 3 — Canvas + hosting (3 weeks)
- Canvas app, local mode then hosted mode ([07](architecture/components/07-canvas.md))
- Netlify previews with `flows.json` + snapshots ([10](architecture/components/10-hosting.md))

**Exit:** pushing a branch shows the whole flow as live frames on the hosted canvas.

## Distribution (before Phase 4, about 1 week) — done 2026-11-03
Open core, per [ADR 015](decisions/015-open-core-and-hosted-platform.md):
- Publish `@cogitato/*` to public npm with versioned releases (Changesets plus a GitHub Action).
- Make the template stand-alone: pinned versions, and `npm create cogitato`.
- Make the plugin marketplace public, and pick a license (#13).
- Create the private platform repo.

Name, license, release process and the create command: [ADR 016](decisions/016-naming-and-distribution.md).

**Exit:** a prototype created outside this repo installs from npm, validates, builds with snapshots, and loads the plugin from the public marketplace.

Met on 2026-11-03 with 0.1.0 from public npm and the marketplace at `JaffeJoseph/cogitato`. Releases are staged by CI and made public by a maintainer (ADR 016). The platform repo is `JaffeJoseph/cogitato-platform` (private).

## Phase 4 — Annotations (2–3 weeks, platform repo)
- Comment service with anchors, types, realtime, version awareness ([08](architecture/components/08-annotations.md))

**Exit:** designers and developers comment together in real time; comments survive redesigns.

## Phase 5 — Intake (3–4 weeks)
- Source adapters, auditor agent, decision review page, re-runs ([06](architecture/components/06-intake.md))
- Start with two paths: mature code system, and brand docs only

**Exit:** intake on a second, different product produces a signed-off kit without hand-editing the contract.

## Phase 6 — Handoff (2 weeks)
- `prepare-handoff`, `implement-handoff` ([09](architecture/components/09-handoff.md))

**Exit:** a developer builds a real feature in production from a Cogitato spec.

## Later
- Legacy-code and Figma-only intake paths
- Claude Code reading open comments ("address the feedback")
- Next.js template variant
- Variant comparison and parallel-session explorations on the canvas

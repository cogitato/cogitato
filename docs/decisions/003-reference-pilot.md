# ADR 003: Phase 0 reference contract is an invented product

- **Status:** Accepted for Phase 0; revisit before Phase 2
- **Date:** 2026-11-01
- **Partially resolves:** open decision #12

## Context
The roadmap calls for one pilot product with a known design system for Phases 1–4. Phase 0 only needs a realistic contract to test the schemas, and no pilot team has been chosen yet.

## Decision
Use **"Acme Shop"**, an invented e-commerce product, as the reference contract in `packages/contract/fixtures/reference/design/`. It covers every format:

- 6 components with every `source` and `confidence` level: Button, Input, Card, Banner, Stack, Text
- DTCG tokens for color (with aliases), space, radius, type, typography, shadow and duration
- One decided and one open decision, and one gap (`Stepper`)
- A checkout flow (cart → shipping → payment → confirmed, plus failure states), matching the `flows.json` example in `interfaces.md`
- Three annotations (intent, resolved question, archived feedback) and a full handoff spec

Known-bad cases in `fixtures/bad/` are edits applied to a copy of this reference. Each case lists the issue codes it must produce.

## Consequences
- Phases 0–1 can go ahead without a pilot team.
- The Phase 2 exit test needs a real designer, so a **real pilot product must be chosen before Phase 2**. Decision #12 stays open for that.
- The reference stays in the repo as a regression fixture after a real pilot is chosen.

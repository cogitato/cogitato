# Open Decisions

Decisions needed before or during each phase. Leanings are proposals, not commitments. Record outcomes as ADRs in this folder (`001-<title>.md`).

| # | Decision | Needed by | Options | Leaning |
|---|----------|-----------|---------|---------|
| 1 | Prototype stack | Phase 1 | React+Vite, Next.js, match production | **Decided: React 18 + TS + Vite + React Router** ([ADR 005](005-prototype-stack.md)) |
| 2 | Token format | Phase 0 | DTCG, Style Dictionary legacy, custom | **Decided: DTCG subset** ([ADR 001](001-token-format-dtcg.md)) |
| 3 | Kit CLI distribution | Phase 1 | npm devDependency, bundled in plugin | **Decided: pinned devDependency** ([ADR 006](006-kit-cli-distribution.md)) |
| 4 | Flow edge declaration | Phase 1 | Co-located with screens, separate `flows.ts` | **Decided: separate `src/flows.ts`, read statically** ([ADR 007](007-screen-and-flow-registration.md)) |
| 5 | Plugin marketplace | Phase 2 | Private team repo, public marketplace | **Decided: this repo is the marketplace, a private GitHub repo for the pilot** ([ADR 009](009-plugin-distribution.md)) |
| 6 | Canvas library | Phase 3 | React Flow, tldraw (check license), custom | **Decided: React Flow, canvas at `/__canvas` in every prototype** ([ADR 012](012-canvas.md)) |
| 7 | Hosting | Phase 3 | Netlify, Vercel | **Decided: the platform builds and hosts previews on AWS** (platform ADR 001). Netlify ([ADR 013](013-hosting.md)) is superseded |
| 8 | Comment backend | Phase 4 | Liveblocks, Supabase, Yjs self-hosted | Evaluate in a spike |
| 9 | Auth | Phase 4 | GitHub OAuth, team SSO | GitHub OAuth |
| 10 | Figma access in intake | Phase 5 | Figma connector/MCP, exported JSON, screenshots | Connector if available, JSON fallback |
| 11 | Figma's role long-term | Later | Early exploration only, replaced | Parked (left open in the concept doc) |
| 12 | Pilot product | Phase 2 | — | Phase 0–1 use the invented "Acme Shop" reference ([ADR 003](003-reference-pilot.md)); Phase 2 was built against it too. A real product must be chosen before the first designer test (Phase 2 exit) |
| 13 | License for the open packages | Before publishing | MIT, Apache 2.0, source-available (BSL, Elastic) | **Decided: Apache 2.0 with DCO sign-off** ([ADR 016](016-naming-and-distribution.md)) |
| 14 | Saving without GitHub | Before non-technical customers | Require GitHub accounts, platform-backed saving | Require GitHub for the pilot; revisit with the hosted platform |
| 15 | Pricing unit | Before the first paid customer | Editor seats (viewers free), per prototype, per company tier | Editor seats with free viewers, plus tiers for intake and SSO |
| 16 | npm scope and registry | Distribution phase | `@protokit` (taken), another scope | **Decided: `@cogitato` on public npm, with the name provisional and the brand only at the edges** ([ADR 016](016-naming-and-distribution.md)) |
| 17 | CLA for outside contributions | Before dual licensing, if ever | DCO only, CLA | DCO only while everything is Apache 2.0 |

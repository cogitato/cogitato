# 10 · Hosting + Previews

**Location:** the private platform repo (`cogitato-platform`)  ·  **Phase:** 3

## Responsibility
Shared viewing. Claude Code is not involved here.

## Pieces
- **Prototype previews:** the platform's GitHub App builds every branch of an org's design workspace and hosts one preview per changed prototype, behind the org's sign-in. The build runs `kit export-flows` and snapshot generation, and publishes `flows.json` alongside the app.
- **Canvas + collab:** the team canvas and the comment service run on the platform too (Phase 4).
- **Framing:** previews must allow being iframed by the canvas origin (`Content-Security-Policy: frame-ancestors`).

## Decided
The platform builds and hosts previews on AWS: our GitHub App reads the org's repo, builds in a sandbox, and serves previews from a separate preview domain with an access check at the edge (platform ADR 001 and the hosted previews spec in `cogitato-platform`). Preview links come from `previewHost` and the workspace's `"kit": { "previewUrl", "org" }` (ADR 017). Netlify ([ADR 013](../../decisions/013-hosting.md)) is superseded, and the template ships no host config: a prototype's build is a static site that any host can serve if every address serves `index.html`.

## Done when
- Pushing a branch to an org's workspace produces a protected preview that the canvas loads as frames, with no manual steps.

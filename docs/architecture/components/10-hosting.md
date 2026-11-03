# 10 · Hosting + Previews

**Location:** `infra/`  ·  **Phase:** 3

## Responsibility
Shared viewing. Claude Code is not involved here.

## Pieces
- **Prototype previews:** each prototype repo connected to Netlify; every branch push gets a preview deploy. Build step runs `kit export-flows` and snapshot generation, and publishes `flows.json` alongside the app.
- **Canvas + collab:** deployed once for the team (Netlify for the canvas, plus whichever backend the comment service uses).
- **CORS / framing:** preview deploys must allow being iframed by the canvas origin (set `Content-Security-Policy: frame-ancestors`).

## Decided
Netlify, with the two `netlify.toml` files, SPA fallback, `frame-ancestors 'self'`, best-effort Playwright snapshots, and `previewUrl` for preview links ([ADR 013](../../decisions/013-hosting.md)). Configured and tested locally; the first real deploy is pending.

## Open questions
- Access control for previews (password protection or team SSO).

## Done when
- Pushing a branch produces a preview that the hosted canvas can load as frames, with no manual steps.

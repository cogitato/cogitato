# ADR 013: Netlify branch previews, with best-effort snapshots

- **Status:** Superseded (2026-11-12). Cogitato no longer uses Netlify: hosted previews come from the platform (platform ADR 001), and the template ships no Netlify config. Never deployed.
- **Date:** 2026-11-02
- **Resolves:** open decision #7

## Decision
- **Host:** Netlify. Every branch push gets a preview deploy, and its canvas is at `<preview>/__canvas` (ADR 012).
- **Config files:**
  - **`templates/prototype-react/netlify.toml`**, for prototype repos made from the template:
    - Builds with `npx playwright install chromium && pnpm build`.
    - Publishes `dist`.
  - **`netlify.toml` at the repo root**, for the pilot, deploying the template from this monorepo:
    - Builds with `pnpm --filter @cogitato/template-prototype-react... build`; the `...` builds every workspace package it depends on first.
    - Publishes `templates/prototype-react/dist`.
  - Both serve every path from `index.html`, because screens are client-side routes. Both set `Content-Security-Policy: frame-ancestors 'self'`, so a preview can only be framed by its own canvas. Phase 4's team canvas widens this to its origin.
- **Snapshots:**
  - The template's `build` ends with `kit snapshots`. It serves `dist` with `vite preview`, opens every state in Playwright Chromium at 1280×800, and writes `dist/__kit-data/snapshots/<node>.jpg` and `snapshots.json` (`snapshots.schema.json`).
  - It is **best effort**: if Playwright or its browser isn't available, it prints one plain sentence and exits 0, and the canvas shows placeholders.
- **Preview links:** a prototype's `package.json` may set `"kit": { "previewUrl": "https://{branch}--<site>.netlify.app" }`.
  - `kit save` then reports `<preview>/__canvas` after a successful push.
  - The branch is slugged the way Netlify names branch deploys (`design/sam-0102` → `design-sam-0102`).

## Why
- Netlify does branch previews with no extra service, and a monorepo base directory works with pnpm workspaces.
- Snapshots make a zoomed-out canvas load instantly. They aren't worth a failed deploy.

## Open
- **Access control:** preview URLs are public unless protected, and Netlify's password protection is a paid feature. Decide before a pilot with real product designs.
- **First real deploy:** connect the GitHub repo in Netlify, turn on branch deploys for all branches, and set `previewUrl` with the site name. Whether the Netlify build image can run Chromium for snapshots is confirmed then; if it can't, previews still work, with placeholders.

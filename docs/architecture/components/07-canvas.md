# 07 · Canvas App

**Location:** `apps/canvas`  ·  **Phase:** 3

## Responsibility
The Figma-like overview: every screen and state as a live, interactive frame, laid out as flows.

## Behavior
- Reads `flows.json` from a base URL (local dev server or Netlify preview).
- Renders each state as an iframe at `{route}?fixture=..&kit-frame=1`.
- Zoomed out: static snapshots. Zoomed in or clicked: frame becomes live. (Performance with dozens of frames.)
- Flow edges drawn as arrows between frames.
- Per-frame status: exploring, in review, approved, handed off.
- Branch/version picker; variant comparison side by side.
- Modes: **local** (designer's localhost, auto-refresh) and **hosted** (shared, with comments).

## Snapshots
Generated at build time (Playwright screenshot per frame, uploaded with the preview deploy) so zoomed-out views load instantly.

## Decided (Phase 3)
- **Library:** React Flow, packaged as `@cogitato/canvas` and mounted at `/__canvas` in every prototype, so it's same-site with its frames ([ADR 012](../../decisions/012-canvas.md)).
- **Bridge:** accepts messages only from its own iframes on its own origin.
- **Status:** read from and written to `flows.json` ([ADR 014](../../decisions/014-frame-status.md)).

## Still open
- **Team canvas (Phase 4):** one site that switches between branch previews, with comments. It reuses `@cogitato/canvas`. It needs cross-origin framing (`frame-ancestors` widened to its origin) and an origin allowlist per preview.
- **Variant comparison:** side by side (Later).

## Done when
- A 10-screen flow with 25 states loads in under 3 seconds and any frame is interactive within 1 second of clicking.

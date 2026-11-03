# ADR 012: The canvas lives inside every prototype, built on React Flow

- **Status:** Accepted
- **Date:** 2026-11-02
- **Resolves:** open decision #6, and the 07-canvas cross-origin question for Phase 3

## Decision
- **Library:** React Flow (`@xyflow/react` 12, MIT). Frames are custom nodes, flow edges are labelled smoothstep edges, and React Flow provides pan, zoom, the minimap and offscreen culling (`onlyRenderVisibleElements`).
- **Packaging:** the canvas is a component library, `@cogitato/canvas`. The runtime mounts it at **`/__canvas`** in every prototype and loads it lazily, so screens don't pay for it. In dev the canvas sits next to the screens on `localhost:5173`, and in a preview deploy on the preview's own site. A team-wide canvas site that switches between branches reuses the same package in Phase 4.
- **Data:** it reads `/__kit-data/flows.json`, plus `/__kit-data/snapshots.json` when the build made snapshots (ADR 013).
  - **Dev:** the Vite plugin serves `flows.json` from disk. The canvas polls it every 1.5 s, so Claude's edits appear without a reload. Polling is used instead of an HMR event because the canvas package may be pre-bundled by Vite, where HMR isn't available.
  - **Build:** the plugin copies `flows.json` into `dist/__kit-data/`.
- **Layout:** one column per screen in flow order, the screen's states stacked below, and a fixed frame size (desktop 1280×800 or mobile 390×844). A flow picker narrows the view to one flow. `?flow=`, `?size=` and `?focus=<node>` are kept in the URL, and `kit link --canvas` and the `canvas_link` tool use `?focus=`.
- **Rendering:** each frame is one of three things.
  - **Placeholder** when there's no snapshot.
  - **Snapshot** when one exists and was taken at the frame's width.
  - **Live iframe** (`{route}?fixture=…&kit-frame=1`) when the frame is clicked, or is visible while drawn at least 360 px wide on screen.
  - At most 8 frames are live at once, and the least recently used one drops back to a snapshot or placeholder.
- **Bridge:**
  - The prototype posts `kit:state` on load and after every move between states.
  - When a click inside a live frame moves it to another state, the canvas highlights the arrow, marks the target, and offers "Back to …" on the frame.
  - The canvas accepts messages only when `event.source` is one of its iframes **and** `event.origin` is its own origin. That's the origin allowlist: everything is same-site in Phase 3.
- **Status:** each frame shows its review status (ADR 014). On the dev server, `GET /__kit-data/status` answers `{"editable": true}` and the chip becomes a menu. A static host answers with the app's HTML, so the canvas shows the status read-only.

## Why
- Keeping the canvas on the prototype's own site removes the cross-origin problems for now: no framing allowlist, no CORS, and no list of preview URLs to keep. Pushing a branch is enough to get a canvas.
- React Flow is MIT, built for node graphs, and already handles culling and the minimap. A whiteboard engine would add drawing tools Cogitato doesn't need yet.

## Measured (local dev, 10 screens, 27 states)
- All 27 frames render 315 ms after navigation starts.
- A clicked frame shows its rendered screen 89–104 ms after the click.

## Consequences
- Every prototype bundle has a lazy canvas chunk (about 65 kB gzipped).
- Comments and anchors (Phase 4) build on the same bridge and frames.

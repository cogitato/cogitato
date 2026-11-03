# ADR 005: Prototype stack is React 18 + TypeScript + Vite + React Router

- **Status:** Accepted
- **Date:** 2026-11-02
- **Resolves:** open decision #1

## Decision
- Prototypes (`templates/prototype-react`) use **React 18.3, TypeScript, Vite 6 and react-router-dom 6.28**, with the v7 behaviors opted in through future flags so they don't log warnings.
- Everything prototypes share at runtime lives in **`@cogitato/runtime`**, not in the template, so prototype repos upgrade it as a dependency instead of carrying a copy:
  - `defineScreen` and `defineFlows`
  - fixtures and the `useFixture`, `useGoToState` and `useFrameMode` hooks
  - frame mode and its bridge
  - the dev chrome and the `/__kit` page
  - the Vite plugin
- The template ships with the **Acme Shop** contract, kit and checkout flow. Intake (Phase 5) replaces the contract, kit and screens per product.
- Other production stacks are handled by the contract's `mapping`, not by matching the stack. A Next.js variant stays on the "Later" list.

## Details worth knowing
- **Token CSS** isn't a committed file. The Vite plugin serves `virtual:kit/tokens.css` straight from `tokens.json`, so it can't go stale. It resolves to `/__kit_tokens.css`, because Vite's CSS pipeline ignores `\0` virtual ids.
- **The `/__kit` page is in every build**, not only in dev. Hosted previews (Phase 3) can show the design kit next to the flow.
- **Frame bridge (`?kit-frame=1`):** outbound only in Phase 1 (`kit:rects`, `kit:hover`, `kit:select`, posted to the parent with target origin `*`; they carry positions and ids only).
  - Rects are batched with a timer rather than `requestAnimationFrame`, because browsers pause animation frames in hidden and offscreen frames.
  - Inbound commands and an origin allowlist come with the canvas.
- **Frames hold still.** Screens use `useFrameMode()` to skip timers and auto-advancing behavior when shown as a frame.

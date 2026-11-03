# @cogitato/canvas

The canvas ([07-canvas.md](../../docs/architecture/components/07-canvas.md), [ADR 012](../../docs/decisions/012-canvas.md)). It shows every screen state of a prototype as a frame, laid out as its flows, on [React Flow](https://reactflow.dev).

Every prototype shows it at **`/__canvas`**. The runtime mounts `<Canvas />` there and loads it lazily.

```tsx
import { Canvas } from "@cogitato/canvas";
<Canvas base="" title="Acme Shop" kitHref="/__kit" />
```

- **Data:** reads `{base}/__kit-data/flows.json`, plus `snapshots.json` when the build made snapshots.
- **Layout:** one column per screen in flow order, with its states stacked. The flow picker narrows to one flow. There are desktop and mobile frame sizes.
- **Frames:**
  - Each frame is a placeholder, or a snapshot image if one exists.
  - It becomes a **live iframe** when you click it, or when it's big enough on screen. At most 8 are live at once.
  - A click inside a live frame that moves to another state highlights the arrow it followed, and offers "Back to …".
- **Status:** each frame shows its review status. On the dev server (`GET /__kit-data/status` → `{"editable":true}`) it's a menu that saves to `flows.json` through kit. Elsewhere it's read-only.
- **URL:** `?flow=<id>`, `?size=mobile`, `?focus=<screen.state>` (opens on that frame, live).

`layoutFlows`, `frameUrl`, `touchLive` and `visibleFrames` are exported, pure and unit-tested.

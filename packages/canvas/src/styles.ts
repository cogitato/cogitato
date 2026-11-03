// Styles for the canvas. Cogitato's own UI, not prototype code, so not held to the token rules;
// everything is prefixed `kit-canvas-` to stay out of the prototype's way.
export const CANVAS_CSS = `
.kit-canvas { position: fixed; inset: 0; display: flex; flex-direction: column; background: #f3f4f6;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
.kit-canvas-message { align-items: center; justify-content: center; padding: 24px; text-align: center; }
.kit-canvas-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.kit-canvas-bar select { font: inherit; border: 1px solid #d1d5db; border-radius: 6px; padding: 2px 6px; background: #fff; }
.kit-canvas-muted { color: #6b7280; font-size: 13px; }
.kit-canvas-link { color: #2563eb; margin-left: auto; }
.kit-canvas-notice { color: #991b1b; font-size: 13px; }
.kit-canvas-board { flex: 1; min-height: 0; }
.kit-canvas-frame { background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(17,24,39,.12); overflow: hidden;
  outline: 0 solid #2563eb; transition: outline-width .15s, opacity .15s; }
.kit-canvas-frame-highlight { outline-width: 8px; }
.kit-canvas-frame-dimmed { opacity: .25; }
.kit-canvas-frame-head { display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid #e5e7eb; font-size: 20px; }
.kit-canvas-frame-title { display: flex; gap: 10px; align-items: baseline; min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kit-canvas-frame-title span { color: #6b7280; }
.kit-canvas-frame-body { position: relative; background: #fff; }
.kit-canvas-iframe { display: block; border: 0; background: #fff; }
.kit-canvas-snapshot { display: block; object-fit: cover; object-position: top; }
.kit-canvas-placeholder { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  color: #6b7280; font-size: 40px; background: repeating-linear-gradient(45deg, #fafafa 0 24px, #f3f4f6 24px 48px); cursor: pointer; }
.kit-canvas-placeholder small { font-size: 24px; }
.kit-canvas-status { font: inherit; font-size: 16px; padding: 4px 12px; border-radius: 999px; border: 0; background: #f3f4f6; color: #374151; }
.kit-canvas-status-in-review { background: #fef9c3; color: #854d0e; }
.kit-canvas-status-approved { background: #dcfce7; color: #166534; }
.kit-canvas-status-handed-off { background: #dbeafe; color: #1e40af; }
.kit-canvas-back { font: inherit; font-size: 16px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 4px 10px; cursor: pointer; }
.kit-canvas-handle { opacity: 0; }
.kit-canvas .react-flow__edge-path { stroke: #9ca3af; stroke-width: 3; }
.kit-canvas .kit-canvas-edge-highlight .react-flow__edge-path { stroke: #2563eb; stroke-width: 6; }
.kit-canvas .react-flow__edge-text { font-size: 22px; }
`;

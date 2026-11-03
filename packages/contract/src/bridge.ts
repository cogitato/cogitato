// Messages between a prototype shown in frame mode (?kit-frame=1) and the canvas around it.
// The prototype posts them to its parent window. They carry element positions, ids and state
// names only, so they're posted with targetOrigin "*"; the canvas only accepts them from its
// own iframes on its own origin (ADR 012).

/** Query parameter that puts a prototype page in frame mode. */
export const FRAME_PARAM = "kit-frame";

export interface KitRect {
  kitId: string;
  /** Pixels from the top-left of the document. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FrameMessage =
  | { type: "kit:rects"; frame: { width: number; height: number }; rects: KitRect[] }
  | { type: "kit:hover"; kitId: string | null }
  | { type: "kit:select"; kitId: string }
  /** The state the frame is showing, "{screen id}.{state}". Sent on load and after every move between states. */
  | { type: "kit:state"; node: string };

export function isFrameMessage(data: unknown): data is FrameMessage {
  return typeof data === "object" && data !== null && typeof (data as { type?: unknown }).type === "string" &&
    (data as { type: string }).type.startsWith("kit:");
}

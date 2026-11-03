import type { FlowManifest, FrameStatus as MaybeStatus } from "@cogitato/contract/browser";

export type FrameStatus = NonNullable<MaybeStatus>;

// Turns flows.json into frames and arrows. Pure, so the layout is the same for everyone who
// opens the canvas: one column per screen in flow order, the screen's states stacked below.

export type FrameSizeName = "desktop" | "mobile";

export const FRAME_SIZES: Record<FrameSizeName, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

/** Height of the title bar above each frame, in canvas pixels at zoom 1. */
export const HEADER_HEIGHT = 56;

/** "all" shows every screen and every flow's arrows. */
export type FlowChoice = "all" | (string & {});

export interface FrameNode {
  /** "{screen id}.{state}" */
  id: string;
  screenId: string;
  stateId: string;
  screenTitle: string;
  stateTitle: string;
  route: string;
  fixture: string;
  status: FrameStatus;
  x: number;
  y: number;
}

export interface FrameEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface Layout {
  nodes: FrameNode[];
  edges: FrameEdge[];
  width: number;
  height: number;
}

const statusOf = (m: FlowManifest, node: string): FrameStatus => (m.status?.[node] ?? "exploring") as FrameStatus;

export function layoutFlows(m: FlowManifest, flow: FlowChoice, size: FrameSizeName): Layout {
  const { width, height } = FRAME_SIZES[size];
  const colGap = Math.round(width * 0.35);
  const rowGap = Math.round(height * 0.2);
  const chosen = flow === "all" ? undefined : m.flows.find((f) => f.id === flow);
  const inFlow = chosen ? new Set(chosen.nodes) : undefined;

  const nodes: FrameNode[] = [];
  let column = 0;
  let maxRows = 0;
  for (const screen of m.screens) {
    const states = screen.states.filter((s) => !inFlow || inFlow.has(`${screen.id}.${s.id}`));
    if (!states.length) continue;
    states.forEach((s, row) => {
      const id = `${screen.id}.${s.id}`;
      nodes.push({
        id,
        screenId: screen.id,
        stateId: s.id,
        screenTitle: screen.title,
        stateTitle: s.title ?? s.id,
        route: screen.route,
        fixture: s.fixture,
        status: statusOf(m, id),
        x: column * (width + colGap),
        y: row * (height + HEADER_HEIGHT + rowGap),
      });
    });
    maxRows = Math.max(maxRows, states.length);
    column++;
  }

  const shown = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const edges: FrameEdge[] = [];
  for (const f of chosen ? [chosen] : m.flows) {
    for (const e of f.edges) {
      const id = `${e.from}->${e.to}`;
      if (seen.has(id) || !shown.has(e.from) || !shown.has(e.to)) continue;
      seen.add(id);
      edges.push({ id, from: e.from, to: e.to, ...(e.label ? { label: e.label } : {}) });
    }
  }
  return {
    nodes,
    edges,
    width: column ? column * width + (column - 1) * colGap : 0,
    height: maxRows ? maxRows * (height + HEADER_HEIGHT) + (maxRows - 1) * rowGap : 0,
  };
}

/** Address of one state in frame mode. `base` is "" for the same site, or another site's origin. */
export function frameUrl(base: string, node: Pick<FrameNode, "route" | "fixture">): string {
  return `${base}${node.route}?fixture=${encodeURIComponent(node.fixture)}&kit-frame=1`;
}

/**
 * Live frames, most recently used first. Live frames are real iframes, so only a few are kept:
 * touching one moves it to the front and drops the oldest past `max`.
 */
export function touchLive(live: readonly string[], id: string, max: number): string[] {
  return [id, ...live.filter((x) => x !== id)].slice(0, max);
}

/** Frames whose box overlaps the visible part of the canvas. */
export function visibleFrames(
  nodes: readonly FrameNode[],
  size: FrameSizeName,
  viewport: { x: number; y: number; zoom: number },
  screen: { width: number; height: number },
): string[] {
  const { width, height } = FRAME_SIZES[size];
  const left = -viewport.x / viewport.zoom;
  const top = -viewport.y / viewport.zoom;
  const right = left + screen.width / viewport.zoom;
  const bottom = top + screen.height / viewport.zoom;
  return nodes
    .filter((n) => n.x < right && n.x + width > left && n.y < bottom && n.y + height + HEADER_HEIGHT > top)
    .map((n) => n.id);
}

/** Frames go live on their own once they're big enough on screen to use. */
export const LIVE_MIN_SCREEN_WIDTH = 360;
export const MAX_LIVE_FRAMES = 8;

export const STATUS_LABELS: Record<FrameStatus, string> = {
  exploring: "Exploring",
  "in-review": "In review",
  approved: "Approved",
  "handed-off": "Handed off",
};

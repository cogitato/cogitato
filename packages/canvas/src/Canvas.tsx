import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { isFrameMessage, type FlowManifest, type SnapshotManifest } from "@cogitato/contract/browser";
import { FrameCard, type FrameCardNode, type FrameMode } from "./FrameCard.js";
import {
  FRAME_SIZES,
  HEADER_HEIGHT,
  LIVE_MIN_SCREEN_WIDTH,
  MAX_LIVE_FRAMES,
  STATUS_LABELS,
  layoutFlows,
  touchLive,
  visibleFrames,
  type FlowChoice,
  type FrameSizeName,
  type FrameStatus,
} from "./layout.js";
import { CANVAS_CSS } from "./styles.js";

export interface CanvasProps {
  /** Site the prototype is on: "" for this site (the /__canvas route), or another origin. */
  base?: string;
  /** Shown in the header, e.g. the product name. */
  title?: string;
  /** Link to the design kit page, if there is one. */
  kitHref?: string;
}

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; flows: FlowManifest; text: string };

const nodeTypes = { frame: FrameCard };
const POLL_MS = 1500;

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return { flow: p.get("flow") ?? undefined, focus: p.get("focus") ?? undefined, size: (p.get("size") as FrameSizeName | null) ?? undefined };
}

function writeParam(key: string, value: string | undefined) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", url);
}

async function fetchText(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") ?? "";
    // Static hosts answer unknown paths with the app's index.html; that isn't data.
    if (type.includes("text/html")) return undefined;
    return await res.text();
  } catch {
    return undefined;
  }
}

function CanvasInner({ base = "", title, kitHref }: CanvasProps) {
  const params = useMemo(readParams, []);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [snapshots, setSnapshots] = useState<SnapshotManifest | undefined>();
  // Undefined until the dev server has answered whether status can be changed here.
  const [editable, setEditable] = useState<boolean | undefined>();
  const [flow, setFlow] = useState<FlowChoice>(params.flow ?? "all");
  const [size, setSize] = useState<FrameSizeName>(params.size && params.size in FRAME_SIZES ? params.size : "desktop");
  const [statusFilter, setStatusFilter] = useState<FrameStatus | "">("");
  const [live, setLive] = useState<string[]>(params.focus ? [params.focus] : []);
  const [highlight, setHighlight] = useState<{ nodes: string[]; edge?: string } | undefined>();
  const [wandered, setWandered] = useState<Record<string, string>>({});
  const [reloads, setReloads] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | undefined>();
  const frames = useRef(new Map<string, Window>());
  const container = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  const refresh = useCallback(async () => {
    const text = await fetchText(`${base}/__kit-data/flows.json`);
    if (text === undefined) {
      setLoad((l) => (l.state === "ready" ? l : { state: "error", message: "This prototype has no flow map yet (design/flows.json). Ask Claude to add a screen, or run kit export-flows." }));
      return;
    }
    setLoad((l) => {
      if (l.state === "ready" && l.text === text) return l;
      try {
        return { state: "ready", flows: JSON.parse(text) as FlowManifest, text };
      } catch {
        return { state: "error", message: "The flow map (design/flows.json) couldn't be read." };
      }
    });
  }, [base]);

  // First load: the flow map, snapshots if the build made them, and whether status can be changed
  // here (only the dev server answers /__kit-data/status).
  useEffect(() => {
    void refresh();
    void fetchText(`${base}/__kit-data/snapshots.json`).then((t) => {
      if (!t) return;
      try {
        setSnapshots(JSON.parse(t) as SnapshotManifest);
      } catch {
        /* no snapshots */
      }
    });
    void fetchText(`${base}/__kit-data/status`).then((t) => setEditable(Boolean(t && t.includes('"editable":true'))));
  }, [base, refresh]);

  // While editing locally, pick up changes Claude makes (the flow map is rewritten after each edit).
  useEffect(() => {
    if (!editable) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [editable, refresh]);

  const flows = load.state === "ready" ? load.flows : undefined;
  const layout = useMemo(() => (flows ? layoutFlows(flows, flow, size) : undefined), [flows, flow, size]);

  const updateLive = useCallback(
    (viewport: Viewport) => {
      if (!layout || !container.current) return;
      if (viewport.zoom * FRAME_SIZES[size].width < LIVE_MIN_SCREEN_WIDTH) return;
      const visible = visibleFrames(layout.nodes, size, viewport, { width: container.current.clientWidth, height: container.current.clientHeight });
      if (visible.length) setLive((l) => visible.slice(0, MAX_LIVE_FRAMES).reverse().reduce((acc, id) => touchLive(acc, id, MAX_LIVE_FRAMES), l));
    },
    [layout, size],
  );

  // Open on the focused frame (canvas links from Claude), else fit everything.
  const focused = useRef(false);
  useEffect(() => {
    if (!layout || focused.current) return;
    focused.current = true;
    const target = params.focus && layout.nodes.find((n) => n.id === params.focus);
    requestAnimationFrame(() => {
      if (target) void rf.fitView({ nodes: [{ id: target.id }], maxZoom: 0.8, duration: 0 });
      else void rf.fitView({ padding: 0.08, duration: 0 });
    });
  }, [layout, params.focus, rf]);

  // Messages from live frames: only from our own iframes, on our own site.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isFrameMessage(e.data) || e.data.type !== "kit:state") return;
      const origin = base ? new URL(base).origin : window.location.origin;
      if (e.origin !== origin) return;
      const from = [...frames.current].find(([, win]) => win === e.source)?.[0];
      if (!from) return;
      const to = e.data.node;
      if (to === from) {
        setWandered((w) => {
          if (!(from in w)) return w;
          const { [from]: _gone, ...rest } = w;
          return rest;
        });
        return;
      }
      setWandered((w) => ({ ...w, [from]: to }));
      setHighlight({ nodes: [to], edge: `${from}->${to}` });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [base]);

  useEffect(() => {
    if (!highlight) return;
    const id = setTimeout(() => setHighlight(undefined), 2500);
    return () => clearTimeout(id);
  }, [highlight]);

  const registerFrame = useCallback((node: string, win: Window | null) => {
    if (win) frames.current.set(node, win);
    else frames.current.delete(node);
  }, []);

  const onBack = useCallback((node: string) => {
    setReloads((r) => ({ ...r, [node]: (r[node] ?? 0) + 1 }));
    setWandered((w) => {
      const { [node]: _gone, ...rest } = w;
      return rest;
    });
  }, []);

  const onStatus = useCallback(
    async (node: string, status: FrameStatus) => {
      const res = await fetch(`${base}/__kit-data/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ node, status }),
      }).catch(() => undefined);
      const body = res ? ((await res.json().catch(() => ({}))) as { message?: string }) : {};
      if (!res?.ok) setNotice(body.message ?? "The status couldn't be saved.");
      else setNotice(undefined);
      await refresh();
    },
    [base, refresh],
  );

  const nodes: FrameCardNode[] = useMemo(() => {
    if (!layout) return [];
    return layout.nodes.map((frame) => {
      // Snapshots were taken at one window size; at another they'd show the wrong layout.
      const snapshot = snapshots?.viewport.width === FRAME_SIZES[size].width ? snapshots.frames[frame.id] : undefined;
      const mode: FrameMode = live.includes(frame.id) ? "live" : snapshot ? "snapshot" : "placeholder";
      return {
        id: frame.id,
        type: "frame",
        position: { x: frame.x, y: frame.y },
        // Known sizes let React Flow cull offscreen frames and draw the minimap before measuring.
        width: FRAME_SIZES[size].width,
        height: FRAME_SIZES[size].height + HEADER_HEIGHT,
        draggable: false,
        data: {
          frame,
          mode,
          size,
          base,
          ...(snapshot ? { snapshot: `${base}/__kit-data/${snapshot}` } : {}),
          reloadKey: reloads[frame.id] ?? 0,
          ...(wandered[frame.id] ? { wandered: wandered[frame.id] } : {}),
          highlighted: highlight?.nodes.includes(frame.id) ?? false,
          dimmed: Boolean(statusFilter) && frame.status !== statusFilter,
          editable: editable === true,
          onStatus: (n, s) => void onStatus(n, s),
          onBack,
          registerFrame,
        },
      };
    });
  }, [layout, snapshots, live, size, base, reloads, wandered, highlight, statusFilter, editable, onStatus, onBack, registerFrame]);

  const edges: Edge[] = useMemo(
    () =>
      (layout?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        type: "smoothstep",
        ...(e.label ? { label: e.label } : {}),
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        className: highlight?.edge === e.id ? "kit-canvas-edge-highlight" : "kit-canvas-edge",
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 6,
      })),
    [layout, highlight],
  );

  if (load.state !== "ready" || !flows || !layout) {
    return (
      <div className="kit-canvas kit-canvas-message">
        <style>{CANVAS_CSS}</style>
        {load.state === "error" ? load.message : "Loading the canvas…"}
      </div>
    );
  }

  const states = layout.nodes.length;
  return (
    <div className="kit-canvas">
      <style>{CANVAS_CSS}</style>
      <header className="kit-canvas-bar">
        <strong>{title ?? "Prototype"} canvas</strong>
        <label>
          Flow{" "}
          <select
            value={flow}
            onChange={(e) => {
              setFlow(e.target.value);
              writeParam("flow", e.target.value === "all" ? undefined : e.target.value);
              requestAnimationFrame(() => void rf.fitView({ padding: 0.08 }));
            }}
          >
            <option value="all">All screens</option>
            {flows.flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status{" "}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FrameStatus | "")}>
            <option value="">Any</option>
            {(Object.keys(STATUS_LABELS) as FrameStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size{" "}
          <select
            value={size}
            onChange={(e) => {
              setSize(e.target.value as FrameSizeName);
              writeParam("size", e.target.value === "desktop" ? undefined : e.target.value);
              requestAnimationFrame(() => void rf.fitView({ padding: 0.08 }));
            }}
          >
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>
        </label>
        <span className="kit-canvas-muted">
          {states} state{states === 1 ? "" : "s"}
          {flows.commit ? ` · version ${flows.commit}` : ""}
          {snapshots ? " · snapshots" : ""}
          {editable === false ? " · view only" : ""}
        </span>
        {kitHref && (
          <a className="kit-canvas-link" href={kitHref}>
            Design kit
          </a>
        )}
        {notice && <span className="kit-canvas-notice">{notice}</span>}
      </header>
      <div className="kit-canvas-board" ref={container}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onlyRenderVisibleElements
          minZoom={0.03}
          maxZoom={1.5}
          onMoveEnd={(_e, viewport) => updateLive(viewport)}
          onNodeClick={(_e, node) => setLive((l) => touchLive(l, node.id, MAX_LIVE_FRAMES))}
          onNodeDoubleClick={(_e, node) => void rf.fitView({ nodes: [{ id: node.id }], maxZoom: 1, duration: 300 })}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={48} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => ((n.data as { frame?: { status?: string } }).frame?.status === "approved" ? "#16a34a" : "#9ca3af")} />
        </ReactFlow>
      </div>
    </div>
  );
}

/** The canvas: every screen state of the prototype as a frame, laid out as its flows. */
export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

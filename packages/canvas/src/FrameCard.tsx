import { memo, useEffect, useRef } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FRAME_SIZES, HEADER_HEIGHT, STATUS_LABELS, frameUrl, type FrameNode, type FrameSizeName, type FrameStatus } from "./layout.js";

export type FrameMode = "live" | "snapshot" | "placeholder";

export interface FrameCardData extends Record<string, unknown> {
  frame: FrameNode;
  mode: FrameMode;
  size: FrameSizeName;
  base: string;
  snapshot?: string;
  /** Bumped to reload the live frame (back to its own state). */
  reloadKey: number;
  /** State the live frame moved to after a click inside it, if it's not its own. */
  wandered?: string;
  highlighted: boolean;
  dimmed: boolean;
  editable: boolean;
  onStatus: (node: string, status: FrameStatus) => void;
  onBack: (node: string) => void;
  registerFrame: (node: string, win: Window | null) => void;
}

export type FrameCardNode = Node<FrameCardData, "frame">;

const STATUSES = Object.keys(STATUS_LABELS) as FrameStatus[];

export function StatusChip({ node, status, editable, onStatus }: { node: string; status: FrameStatus; editable: boolean; onStatus: FrameCardData["onStatus"] }) {
  if (!editable) return <span className={`kit-canvas-status kit-canvas-status-${status}`}>{STATUS_LABELS[status]}</span>;
  return (
    <select
      className={`kit-canvas-status kit-canvas-status-${status} nodrag`}
      aria-label="Review status"
      value={status}
      onChange={(e) => onStatus(node, e.target.value as FrameStatus)}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function LiveFrame({ data }: { data: FrameCardData }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { frame, register } = { frame: data.frame, register: data.registerFrame };
  useEffect(() => {
    const win = ref.current?.contentWindow ?? null;
    register(frame.id, win);
    return () => register(frame.id, null);
  }, [frame.id, register, data.reloadKey]);
  const { width, height } = FRAME_SIZES[data.size];
  return (
    <iframe
      key={data.reloadKey}
      ref={ref}
      className="kit-canvas-iframe nodrag nopan nowheel"
      title={`${frame.screenTitle}: ${frame.stateTitle}`}
      src={frameUrl(data.base, frame)}
      width={width}
      height={height}
      onLoad={() => register(frame.id, ref.current?.contentWindow ?? null)}
    />
  );
}

/** One screen state on the canvas: a title bar, then the frame (live, snapshot or placeholder). */
export const FrameCard = memo(function FrameCard({ data }: NodeProps<FrameCardNode>) {
  const { frame, mode, size } = data;
  const { width, height } = FRAME_SIZES[size];
  const classes = ["kit-canvas-frame", `kit-canvas-frame-${mode}`, data.highlighted ? "kit-canvas-frame-highlight" : "", data.dimmed ? "kit-canvas-frame-dimmed" : ""];
  return (
    <div className={classes.filter(Boolean).join(" ")} style={{ width }} data-node={frame.id}>
      <Handle type="target" position={Position.Left} className="kit-canvas-handle" />
      <div className="kit-canvas-frame-head" style={{ height: HEADER_HEIGHT }}>
        <div className="kit-canvas-frame-title">
          <strong>{frame.screenTitle}</strong>
          <span>{frame.stateTitle}</span>
        </div>
        {data.wandered && (
          <button type="button" className="kit-canvas-back nodrag" onClick={() => data.onBack(frame.id)}>
            Back to {frame.stateTitle}
          </button>
        )}
        <StatusChip node={frame.id} status={frame.status} editable={data.editable} onStatus={data.onStatus} />
      </div>
      <div className="kit-canvas-frame-body" style={{ width, height }}>
        {mode === "live" ? (
          <LiveFrame data={data} />
        ) : mode === "snapshot" && data.snapshot ? (
          <img className="kit-canvas-snapshot" src={data.snapshot} alt={`${frame.screenTitle}: ${frame.stateTitle}`} width={width} height={height} />
        ) : (
          <div className="kit-canvas-placeholder">
            <div>{frame.screenTitle}</div>
            <div>{frame.stateTitle}</div>
            <small>Click to open</small>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="kit-canvas-handle" />
    </div>
  );
});

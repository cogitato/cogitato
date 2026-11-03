// Frame mode (?kit-frame=1): the prototype is shown inside a canvas iframe.
// The bridge is outbound only. Messages carry element positions, ids and state names only, so
// they're posted with targetOrigin "*"; the canvas accepts them only from its own frames (ADR 012).
import { FRAME_PARAM, type FrameMessage, type KitRect } from "@cogitato/contract/browser";

export { FRAME_PARAM, type FrameMessage, type KitRect };

export function isFrameMode(search: string): boolean {
  return new URLSearchParams(search).get(FRAME_PARAM) === "1";
}

/** Tells the canvas which state this frame is showing ("{screen id}.{state}"). */
export function postFrameState(node: string, win: Window = window): void {
  win.parent.postMessage({ type: "kit:state", node } satisfies FrameMessage, "*");
}

function kitIdOf(target: EventTarget | null): string | null {
  const el = target instanceof Element ? target.closest("[data-kit-id]") : null;
  return el?.getAttribute("data-kit-id") ?? null;
}

export function collectRects(doc: Document = document): KitRect[] {
  const scrollX = doc.defaultView?.scrollX ?? 0;
  const scrollY = doc.defaultView?.scrollY ?? 0;
  return Array.from(doc.querySelectorAll<HTMLElement>("[data-kit-id]")).map((el) => {
    const r = el.getBoundingClientRect();
    return { kitId: el.dataset.kitId ?? "", x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  });
}

/** Starts posting element positions and hover/select events to the parent window. Returns a stop function. */
export function startFrameBridge(win: Window = window): () => void {
  const post = (message: FrameMessage) => win.parent.postMessage(message, "*");
  const doc = win.document;

  // Batched with a timer, not requestAnimationFrame: browsers pause animation frames in hidden
  // and offscreen frames, and a zoomed-out canvas is mostly offscreen frames.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sendRects = () => {
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      const root = doc.documentElement;
      post({ type: "kit:rects", frame: { width: root.scrollWidth, height: root.scrollHeight }, rects: collectRects(doc) });
    }, 50);
  };

  let hovered: string | null = null;
  const onOver = (e: Event) => {
    const kitId = kitIdOf(e.target);
    if (kitId === hovered) return;
    hovered = kitId;
    post({ type: "kit:hover", kitId });
  };
  const onClick = (e: Event) => {
    const kitId = kitIdOf(e.target);
    if (kitId) post({ type: "kit:select", kitId });
  };

  const observer = new MutationObserver(sendRects);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
  win.addEventListener("resize", sendRects);
  win.addEventListener("scroll", sendRects, { passive: true });
  doc.addEventListener("mouseover", onOver);
  doc.addEventListener("click", onClick, true);
  sendRects();

  return () => {
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    win.removeEventListener("resize", sendRects);
    win.removeEventListener("scroll", sendRects);
    doc.removeEventListener("mouseover", onOver);
    doc.removeEventListener("click", onClick, true);
  };
}

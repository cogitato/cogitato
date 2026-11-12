import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FlowManifest } from "@cogitato/contract/browser";
import { Canvas, FrameCard, frameUrl, layoutFlows, touchLive, visibleFrames, type FrameCardData, type FrameCardNode } from "../src/index.js";

// vitest runs from the package folder.
const flows = JSON.parse(readFileSync(join(process.cwd(), "../../templates/workspace-react/prototypes/checkout/design/flows.json"), "utf8")) as FlowManifest;

beforeAll(() => {
  // jsdom has no ResizeObserver; React Flow measures with it.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("layoutFlows", () => {
  it("puts each screen in a column in flow order, with its states stacked", () => {
    const { nodes, edges } = layoutFlows(flows, "all", "desktop");
    expect(nodes.map((n) => n.id)).toEqual([
      "cart.default",
      "cart.empty",
      "checkout.shipping.default",
      "checkout.shipping.invalid-address",
      "checkout.payment.default",
      "checkout.payment.processing",
      "checkout.payment.card-declined",
      "checkout.confirmation.default",
    ]);
    const at = (id: string) => nodes.find((n) => n.id === id)!;
    expect(at("cart.empty").x).toBe(at("cart.default").x);
    expect(at("cart.empty").y).toBeGreaterThan(at("cart.default").y);
    expect(at("checkout.shipping.default").x).toBeGreaterThan(at("cart.default").x + 1280);
    expect(edges).toContainEqual({ id: "checkout.payment.default->checkout.payment.processing", from: "checkout.payment.default", to: "checkout.payment.processing", label: "Pay now" });
    expect(edges).toHaveLength(6);
  });

  it("shows only one flow's states when a flow is picked, and statuses from flows.json", () => {
    const withStatus = { ...flows, status: { "checkout.payment.card-declined": "in-review" } } as FlowManifest;
    const { nodes } = layoutFlows(withStatus, "checkout", "mobile");
    expect(nodes.map((n) => n.id)).not.toContain("cart.empty");
    expect(nodes.find((n) => n.id === "checkout.payment.card-declined")?.status).toBe("in-review");
    expect(nodes.find((n) => n.id === "cart.default")?.status).toBe("exploring");
  });

  it("builds frame-mode addresses", () => {
    expect(frameUrl("", { route: "/checkout/payment", fixture: "card-declined" })).toBe("/checkout/payment?fixture=card-declined&kit-frame=1");
  });
});

describe("live frames", () => {
  it("keeps the most recently used frames, up to the limit", () => {
    let live: string[] = [];
    for (const id of ["a", "b", "c", "a"]) live = touchLive(live, id, 2);
    expect(live).toEqual(["a", "c"]);
  });

  it("finds the frames in view", () => {
    const { nodes } = layoutFlows(flows, "all", "desktop");
    // Zoom 0.5, looking at the top-left: the first column only.
    expect(visibleFrames(nodes, "desktop", { x: 0, y: 0, zoom: 0.5 }, { width: 700, height: 500 })).toEqual(["cart.default"]);
  });
});

describe("FrameCard", () => {
  const frame = layoutFlows(flows, "all", "desktop").nodes[0]!;
  const data = (over: Partial<FrameCardData>): FrameCardData => ({
    frame,
    mode: "placeholder",
    size: "desktop",
    base: "",
    reloadKey: 0,
    highlighted: false,
    dimmed: false,
    editable: false,
    onStatus: () => {},
    onBack: () => {},
    registerFrame: () => {},
    ...over,
  });
  const show = (d: FrameCardData) =>
    render(
      <ReactFlowProvider>
        <FrameCard {...({ id: frame.id, data: d } as unknown as NodeProps<FrameCardNode>)} />
      </ReactFlowProvider>,
    );

  it("shows a placeholder, a snapshot, or the live frame", () => {
    show(data({}));
    expect(screen.getByText("Click to open")).toBeTruthy();
    cleanup();
    show(data({ mode: "snapshot", snapshot: "/__kit-data/snapshots/cart.default.jpg" }));
    expect(screen.getByRole("img").getAttribute("src")).toBe("/__kit-data/snapshots/cart.default.jpg");
    cleanup();
    show(data({ mode: "live" }));
    expect(screen.getByTitle("Cart: Two items").getAttribute("src")).toBe("/cart?fixture=default&kit-frame=1");
  });

  it("lets status be changed only where it's editable", () => {
    show(data({}));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Exploring")).toBeTruthy();
    cleanup();
    show(data({ editable: true }));
    expect(screen.getByRole("combobox", { name: "Review status" })).toBeTruthy();
  });
});

describe("Canvas", () => {
  it("loads the flow map and says when status is view-only", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.endsWith("/flows.json")
        ? new Response(JSON.stringify(flows), { headers: { "content-type": "application/json" } })
        : new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
    );
    render(<Canvas title="Acme Shop" />);
    await waitFor(() => expect(screen.getByText(/8 states/)).toBeTruthy());
    expect(screen.getByText(/view only/)).toBeTruthy();
    expect(screen.getByText("Acme Shop canvas")).toBeTruthy();
  });

  it("explains a missing flow map in plain words", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    render(<Canvas />);
    await waitFor(() => expect(screen.getByText(/has no flow map yet/)).toBeTruthy());
  });
});

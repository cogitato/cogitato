import { describe, expect, it } from "vitest";
import { isFrameMessage, validateFormat } from "../src/index.js";

const good = {
  schemaVersion: 1,
  commit: "9a64ed3",
  viewport: { width: 1280, height: 800 },
  frames: { "checkout.payment.card-declined": "snapshots/checkout.payment.card-declined.jpg" },
};

describe("snapshots.json", () => {
  it("accepts a manifest written by kit snapshots", () => {
    expect(validateFormat("snapshots", good)).toEqual({ ok: true, issues: [] });
  });

  it("rejects frames that aren't screen states or images in snapshots/", () => {
    const codes = (data: unknown) => validateFormat("snapshots", data).issues.map((i) => i.path);
    expect(codes({ ...good, frames: { cart: "snapshots/cart.jpg" } })).not.toEqual([]);
    expect(codes({ ...good, frames: { "cart.default": "../cart.jpg" } })).not.toEqual([]);
    expect(codes({ ...good, viewport: { width: 0, height: 800 } })).not.toEqual([]);
    expect(validateFormat("snapshots", { ...good, schemaVersion: 2 }).issues[0]?.code).toBe("schema-version-too-new");
  });
});

describe("frame bridge messages", () => {
  it("recognises Cogitato messages only", () => {
    expect(isFrameMessage({ type: "kit:state", node: "cart.default" })).toBe(true);
    expect(isFrameMessage({ type: "webpackOk" })).toBe(false);
    expect(isFrameMessage("kit:state")).toBe(false);
  });
});

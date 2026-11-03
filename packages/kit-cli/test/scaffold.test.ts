import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FlowManifest, GapLog } from "@cogitato/contract";
import { KitError, addEdge, addGap, addState, createScreen, exportFlows, projectAt, stateLink, validate, type Project } from "../src/index.js";
import { copyTemplate } from "./helpers.js";

let root: string;
let project: Project;
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const flowsJson = () => JSON.parse(read("design/flows.json")) as FlowManifest;

beforeEach(() => {
  root = copyTemplate();
  project = projectAt(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("createScreen", () => {
  it("writes a screen that validates and shows up in flows.json with its arrow", () => {
    const r = createScreen(project, { id: "checkout.review", title: "Review order", from: "checkout.payment.default", label: "Review" });
    expect(r).toMatchObject({ ok: true, issues: [], node: "checkout.review.default" });
    expect(r.files).toEqual(["src/screens/checkout/review/screen.tsx", "src/flows.ts"]);
    expect(r.link).toBe("http://localhost:5173/checkout/review?fixture=default");
    expect(read("src/screens/checkout/review/screen.tsx")).toMatchSnapshot();

    const m = flowsJson();
    expect(m.screens.find((s) => s.id === "checkout.review")).toMatchObject({ route: "/checkout/review", title: "Review order" });
    expect(m.flows[0]!.edges).toContainEqual({ from: "checkout.payment.default", to: "checkout.review.default", label: "Review" });
    expect(validate(project)).toEqual({ ok: true, issues: [] });
  });

  it("refuses ids, routes and screens that are taken or malformed", () => {
    expect(() => createScreen(project, { id: "cart" })).toThrow(/already a screen called "cart"/);
    expect(() => createScreen(project, { id: "Checkout Review" })).toThrow(KitError);
    expect(() => createScreen(project, { id: "basket", route: "/cart" })).toThrow(/already used by the Cart screen/);
    expect(() => createScreen(project, { id: "basket", route: "basket" })).toThrow(/needs to start with "\/"/);
    expect(() => createScreen(project, { id: "basket", from: "cart.missing" })).toThrow(/no state called "missing"/);
  });
});

describe("addState", () => {
  it("inserts the fixture in the screen's style and adds the arrow", () => {
    const before = read("src/screens/checkout/payment/screen.tsx");
    const r = addState(project, { screen: "checkout.payment", state: "card-expired", from: "checkout.payment.processing", label: "Expired" });
    expect(r).toMatchObject({ ok: true, node: "checkout.payment.card-expired" });
    const after = read("src/screens/checkout/payment/screen.tsx");
    expect(after).toBe(
      before.replace(
        `    "card-declined": { title: "Card declined", data: { declined: true } },\n`,
        `    "card-declined": { title: "Card declined", data: { declined: true } },\n    "card-expired": { title: "Card expired", data: {} },\n`,
      ),
    );
    expect(flowsJson().screens.find((s) => s.id === "checkout.payment")!.states.map((s) => s.id)).toContain("card-expired");
  });

  it("handles a fixtures object written on one line, without a trailing comma", () => {
    const file = "src/screens/checkout/confirmation/screen.tsx";
    const text = read(file).replace(/fixtures: \{[\s\S]*?\n  \},/, 'fixtures: { default: { data: { orderNumber: "#1", email: "a@b.c" } } },');
    writeFileSync(join(root, file), text);
    addState(project, { screen: "checkout.confirmation", state: "gift", title: "Gift order" });
    expect(read(file)).toContain('fixtures: { default: { data: { orderNumber: "#1", email: "a@b.c" } }, gift: { title: "Gift order", data: {} } },');
  });

  it("refuses duplicates, bad names and unknown screens", () => {
    expect(() => addState(project, { screen: "cart", state: "empty" })).toThrow(/already has a "empty" state/);
    expect(() => addState(project, { screen: "cart", state: "Empty Cart" })).toThrow(/isn't a valid state name/);
    expect(() => addState(project, { screen: "basket", state: "x" })).toThrow(/no screen with the id "basket"/);
  });
});

describe("addEdge", () => {
  it("skips an arrow that already exists", () => {
    const before = read("src/flows.ts");
    addEdge(project, { from: "cart.default", to: "checkout.shipping.default" });
    expect(read("src/flows.ts")).toBe(before);
  });

  it("adds a new flow when asked for one that doesn't exist", () => {
    addEdge(project, { flow: "returns", from: "checkout.confirmation.default", to: "cart.default", label: "Shop again" });
    const m = flowsJson();
    expect(m.flows.map((f) => f.id)).toEqual(["checkout", "returns"]);
    expect(m.flows[1]).toEqual({
      id: "returns",
      title: "Returns",
      nodes: ["checkout.confirmation.default", "cart.default"],
      edges: [{ from: "checkout.confirmation.default", to: "cart.default", label: "Shop again" }],
    });
    expect(validate(project).ok).toBe(true);
  });

  it("creates src/flows.ts when there isn't one", () => {
    rmSync(join(root, "src/flows.ts"));
    addEdge(project, { from: "cart.default", to: "cart.empty", label: "Remove items" });
    expect(read("src/flows.ts")).toContain('{ from: "cart.default", to: "cart.empty", label: "Remove items" },');
    expect(exportFlows(project, { check: true }).changed).toBe(false);
    expect(flowsJson().flows).toEqual([
      { id: "cart", title: "Cart", nodes: ["cart.default", "cart.empty"], edges: [{ from: "cart.default", to: "cart.empty", label: "Remove items" }] },
    ]);
  });
});

describe("addGap", () => {
  const now = new Date("2026-11-02T10:00:00.000Z");

  it("appends a schema-valid gap and reuses an open one with the same name", () => {
    const r = addGap(project, { kind: "component", name: "Date Picker", context: "Pick a delivery date", screen: "checkout.shipping", requestedBy: "sam", now });
    expect(r).toEqual({
      created: true,
      gap: {
        id: "gap_date-picker",
        kind: "component",
        name: "Date Picker",
        context: "Pick a delivery date",
        screen: "checkout.shipping",
        requestedBy: "sam",
        status: "open",
        createdAt: "2026-11-02T10:00:00Z",
      },
    });
    expect(addGap(project, { kind: "component", name: "date picker", context: "again", requestedBy: "sam" })).toMatchObject({ created: false, gap: { id: "gap_date-picker" } });
    const log = JSON.parse(read("design/contract/gaps.json")) as GapLog;
    expect(log.gaps.map((g) => g.id)).toEqual(["gap_stepper", "gap_date-picker"]);
    expect(validate(project, { contractOnly: true })).toEqual({ ok: true, issues: [] });
  });

  it("suffixes the id when it's taken by a gap that's closed", () => {
    const log = JSON.parse(read("design/contract/gaps.json")) as GapLog;
    log.gaps[0]!.status = "resolved";
    writeFileSync(join(root, "design/contract/gaps.json"), JSON.stringify(log));
    expect(addGap(project, { kind: "component", name: "Stepper", context: "Progress", requestedBy: "sam", now }).gap.id).toBe("gap_stepper-2");
  });
});

describe("stateLink", () => {
  it("links a state, or a screen's default state", () => {
    expect(stateLink(project, "checkout.payment.card-declined")).toBe("http://localhost:5173/checkout/payment?fixture=card-declined");
    expect(stateLink(project, "checkout.payment", 3000)).toBe("http://localhost:3000/checkout/payment?fixture=default");
    expect(() => stateLink(project, "checkout.payment.nope")).toThrow(/no state called "nope"/);
  });
});

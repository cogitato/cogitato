import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateFormat, type FlowManifest } from "@cogitato/contract";
import {
  canvasLink,
  exportFlows,
  previewLink,
  projectAt,
  saveVersion,
  setStatus,
  freePort,
  snapshotManifest,
  takeSnapshots,
  validate,
  type Project,
} from "../src/index.js";
import { applyOps, copyTemplate, removeTemplate } from "./helpers.js";

let root: string;
let project: Project;
const flows = () => JSON.parse(readFileSync(join(root, "design/flows.json"), "utf8")) as FlowManifest;

beforeEach(() => {
  root = copyTemplate();
  project = projectAt(root);
});
afterEach(() => removeTemplate(root));

describe("setStatus", () => {
  it("records a state's review status in flows.json, and 'exploring' clears it", () => {
    expect(setStatus(project, "checkout.payment.card-declined", "in-review")).toEqual({
      node: "checkout.payment.card-declined",
      status: "in-review",
      previous: "exploring",
    });
    expect(flows().status).toEqual({ "checkout.payment.card-declined": "in-review" });
    expect(validate(project)).toEqual({ ok: true, issues: [] });

    setStatus(project, "checkout.payment.card-declined", "exploring");
    expect(flows().status).toBeUndefined();
  });

  it("refuses unknown states and statuses in plain words", () => {
    expect(() => setStatus(project, "checkout.payment.expired", "approved")).toThrow(/no screen state called "checkout.payment.expired"/);
    expect(() => setStatus(project, "cart.default", "done")).toThrow(/isn't a review status.*in-review \(In review\)/);
  });

  it("survives a flow export, and is dropped when its state goes away", () => {
    setStatus(project, "cart.empty", "approved");
    setStatus(project, "checkout.payment.card-declined", "in-review");
    exportFlows(project);
    expect(flows().status).toEqual({ "cart.empty": "approved", "checkout.payment.card-declined": "in-review" });

    applyOps(root, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: "    empty: {", with: "    nothing: {" }]);
    exportFlows(project);
    expect(flows().status).toEqual({ "checkout.payment.card-declined": "in-review" });
  });
});

describe("links", () => {
  it("opens the canvas on a state's frame", () => {
    expect(canvasLink(project, "checkout.payment.card-declined")).toBe("http://localhost:5173/__canvas?focus=checkout.payment.card-declined");
    expect(canvasLink(project, "cart")).toBe("http://localhost:5173/__canvas?focus=cart.default");
  });

  it("builds the hosted canvas for a branch from the workspace's previewUrl and org", () => {
    expect(previewLink(project, "design/sam-20261102")).toBeUndefined();
    const wsPkg = join(root, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(wsPkg, "utf8")) as Record<string, unknown>;
    writeFileSync(wsPkg, JSON.stringify({ ...pkg, kit: { previewUrl: "https://{host}.acme-proto.app/", org: "acme" } }));
    expect(previewLink(project, "design/sam-20261102", "cart.empty")).toBe("https://design-sam-20261102--checkout--acme.acme-proto.app/__canvas?focus=cart.empty");
  });
});

describe("saving with review statuses and previews", () => {
  const git = (...args: string[]) => spawnSync("git", args, { cwd: join(root, "..", ".."), encoding: "utf8" }).stdout.trim();
  beforeEach(() => {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Sam Designer");
    git("config", "user.email", "sam@example.com");
    git("add", "-A");
    git("commit", "-q", "-m", "start");
  });

  it("saves a status change and describes it", () => {
    setStatus(project, "checkout.payment.card-declined", "in-review");
    const r = saveVersion(project.workspace, { now: new Date("2026-11-02T10:00:00Z") });
    expect(r).toMatchObject({ saved: true, summary: "Mark checkout.payment.card-declined in review" });
  });

  it("gives the preview link once the branch is shared", () => {
    const remote = join(root, "..", `remote-${Date.now()}.git`);
    spawnSync("git", ["init", "-q", "--bare", remote]);
    git("remote", "add", "origin", remote);
    const wsPkg = join(root, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(wsPkg, "utf8")) as Record<string, unknown>;
    writeFileSync(wsPkg, JSON.stringify({ ...pkg, kit: { previewUrl: "https://{host}.acme-proto.app", org: "acme" } }));
    const r = saveVersion(project.workspace, { now: new Date("2026-11-02T10:00:00Z") });
    rmSync(remote, { recursive: true, force: true });
    expect(r).toMatchObject({ pushed: true, previews: [{ prototype: "checkout", url: "https://design-sam-designer-20261102--checkout--acme.acme-proto.app/__canvas" }] });
    expect(r.message).toContain("Your preview will be at https://design-sam-designer-20261102--checkout--acme.acme-proto.app/__canvas");
  });
});

describe("snapshots", () => {
  it("lists one image per state in a valid manifest", () => {
    const m = snapshotManifest(["cart.default", "checkout.payment.card-declined"], "9a64ed3");
    expect(m.frames["checkout.payment.card-declined"]).toBe("snapshots/checkout.payment.card-declined.jpg");
    expect(validateFormat("snapshots", m)).toEqual({ ok: true, issues: [] });
  });

  it("skips with a plain explanation when there's nothing to snapshot or no Playwright", async () => {
    expect((await takeSnapshots(project)).skipped).toMatch(/no built prototype/);
    applyOps(root, [{ op: "write", file: "dist/index.html", text: "<!doctype html>" }]);
    const r = await takeSnapshots(project);
    // Depending on the machine, Playwright is either missing or has no browser installed; either way it skips.
    expect(r).toEqual({ written: 0, skipped: expect.stringMatching(/no snapshots were taken.*The canvas will show placeholders instead.$/) });
  });

  it("picks a free port for the preview when none is given, and honours --port", async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    await new Promise<void>((res, rej) => {
      const s = createServer();
      s.once("error", rej);
      s.listen(port, () => s.close(() => res()));
    });

    applyOps(root, [{ op: "write", file: "dist/index.html", text: "<!doctype html>" }]);
    const used: number[] = [];
    const page = { goto: async () => {}, waitForSelector: async () => {}, waitForLoadState: async () => {}, waitForTimeout: async () => {}, screenshot: async () => {} };
    const deps = {
      launchBrowser: async () => ({ newPage: async () => page, close: async () => {} }),
      startPreview: async (_p: Project, _v: string, _d: string, p: number) => {
        used.push(p);
        return spawn(process.execPath, ["-e", "0"], { stdio: "ignore" });
      },
    };
    await takeSnapshots(project, { deps });
    await takeSnapshots(project, { deps });
    expect(used[0]).not.toBe(4319);
    expect(used[0]).not.toBe(5173);
    expect(used[0]).not.toBe(used[1]);
    await takeSnapshots(project, { deps, port: 4555 });
    expect(used[2]).toBe(4555);
  });
});

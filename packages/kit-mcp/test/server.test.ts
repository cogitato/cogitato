import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { GapLog } from "@cogitato/contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, resolveWorkspace } from "../src/index.js";

const workspaceDir = fileURLToPath(new URL("../../../templates/workspace-react", import.meta.url));

let root: string; // the workspace
let proto: string; // prototypes/checkout
let client: Client;

/** Copies the template workspace (no node_modules). With `second`, prototypes/onboarding is a copy of checkout. */
function copyWorkspace(second = false): string {
  const ws = mkdtempSync(join(tmpdir(), "cogitato-mcp-"));
  for (const part of ["design", "kit", "package.json"]) cpSync(join(workspaceDir, part), join(ws, part), { recursive: true });
  const checkout = join(ws, "prototypes", "checkout");
  for (const part of ["src", "design", "package.json"]) cpSync(join(workspaceDir, "prototypes/checkout", part), join(checkout, part), { recursive: true });
  if (second) cpSync(checkout, join(ws, "prototypes", "onboarding"), { recursive: true });
  return ws;
}

async function connect(ws: string): Promise<Client> {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(resolveWorkspace({ KIT_PROJECT: ws }, tmpdir())!).connect(a);
  const c = new Client({ name: "test", version: "0" });
  await c.connect(b);
  return c;
}

beforeEach(async () => {
  delete process.env.KIT_PROJECT;
  root = copyWorkspace();
  proto = join(root, "prototypes/checkout");
  client = await connect(root);
});
afterEach(async () => {
  await client.close();
  rmSync(root, { recursive: true, force: true });
});

async function call(name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
  const r = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError ?? false };
}

describe("kit MCP server", () => {
  it("lists every tool from the design doc, each with a description", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["add_state", "canvas_link", "create_screen", "get_component", "get_tokens", "list_components", "list_prototypes", "log_gap", "save_version", "set_status", "validate"].sort(),
    );
    for (const t of tools) expect(t.description?.length).toBeGreaterThan(30);
    expect(client.getInstructions()).toContain("instead of reading files in design/contract");
  });

  it("describes the kit", async () => {
    const list = await call("list_components");
    expect(list.text).toContain('- Button (import from "@/kit/Button"; source: production, confidence: high): Triggers an action.');

    const button = await call("get_component", { name: "button" });
    expect(button.text).toContain("- Do: Keep one primary `Button` per view.");
    expect((await call("get_component", { name: "Card" })).text).toContain("- Don't: Nest a `Card` inside another `Card`.");
    expect(button.text).toContain('"onPress"');
    expect(button.text).not.toContain("mapping");

    const missing = await call("get_component", { name: "Stepper" });
    expect(missing).toMatchObject({ isError: true });
    expect(missing.text).toContain("log a gap");

    const tokens = await call("get_tokens", { group: "color.brand" });
    expect(tokens.text).toContain("- color.brand.600 = #2563eb → var(--kit-color-brand-600)");
    expect((await call("get_tokens", { group: "nope" })).isError).toBe(true);
  });

  it("creates screens and states that validate, with links", async () => {
    const screen = await call("create_screen", { id: "checkout.review", title: "Review order", from: "checkout.payment.default", label: "Review" });
    expect(screen.isError).toBe(false);
    expect(screen.text).toContain("On the canvas: http://localhost:5173/__canvas?focus=checkout.review.default");
    expect(screen.text).toContain("On its own: http://localhost:5173/checkout/review?fixture=default");
    expect(screen.text).toContain("It validates: no problems.");

    const state = await call("add_state", { screen: "checkout.review", state: "edit-address", from: "checkout.review.default" });
    expect(state.text).toContain("Created checkout.review.edit-address.");

    const dup = await call("add_state", { screen: "checkout.review", state: "edit-address" });
    expect(dup).toEqual({ isError: true, text: 'The Review order screen already has a "edit-address" state.' });

    expect((await call("validate")).text).toBe("All good: the prototype follows the design contract.");
    expect((await call("canvas_link", { step: "checkout.review.edit-address" })).text).toBe(
      "On the canvas: http://localhost:5173/__canvas?focus=checkout.review.edit-address\nOn its own: http://localhost:5173/checkout/review?fixture=edit-address",
    );
  });

  it("sets review statuses for the canvas", async () => {
    expect((await call("set_status", { step: "checkout.payment.card-declined", status: "in-review" })).text).toBe(
      'checkout.payment.card-declined is now "In review" on the canvas (it was "Exploring").',
    );
    const flows = JSON.parse(readFileSync(join(proto, "design/flows.json"), "utf8")) as { status?: Record<string, string> };
    expect(flows.status).toEqual({ "checkout.payment.card-declined": "in-review" });
    expect((await call("set_status", { step: "cart.missing", status: "approved" })).isError).toBe(true);
  });

  it("logs gaps once", async () => {
    const args = { kind: "component", name: "Date picker", context: "Choose a delivery day", screen: "checkout.shipping" };
    expect((await call("log_gap", args)).text).toBe("Logged gap gap_date-picker: Date picker.");
    expect((await call("log_gap", args)).text).toContain("already logged as gap_date-picker");
    const log = JSON.parse(readFileSync(join(root, "design/contract/gaps.json"), "utf8")) as GapLog;
    expect(log.gaps).toHaveLength(2);
  });

  it("explains that saving needs a history when the prototype has none", async () => {
    const r = await call("save_version");
    expect(r.isError).toBe(true);
    expect(r.text).toContain("doesn't keep a history yet");
  });
});

describe("resolveWorkspace", () => {
  it("prefers KIT_PROJECT, then CLAUDE_PROJECT_DIR, then the working folder", () => {
    expect(resolveWorkspace({ KIT_PROJECT: join(proto, "src") }, tmpdir())?.root).toBe(root);
    expect(resolveWorkspace({ CLAUDE_PROJECT_DIR: root }, tmpdir())?.root).toBe(root);
    expect(resolveWorkspace({}, join(root, "design"))?.root).toBe(root);
    expect(resolveWorkspace({}, tmpdir())).toBeUndefined();
  });
});

describe("a workspace with several prototypes", () => {
  it("works on the prototype named in the call, and asks when it's missing", async () => {
    const two = copyWorkspace(true);
    const c = await connect(two);
    try {
      const asked = await c.callTool({ name: "canvas_link", arguments: { step: "cart" } });
      expect(asked.isError).toBe(true);
      expect(JSON.stringify(asked.content)).toMatch(/several prototypes \(checkout, onboarding\)/);
      const r = await c.callTool({ name: "canvas_link", arguments: { step: "cart", prototype: "onboarding" } });
      expect(r.isError).toBeFalsy();
      const list = await c.callTool({ name: "list_prototypes", arguments: {} });
      expect(JSON.stringify(list.content)).toMatch(/checkout.*onboarding/);
      // checking everything with no prototype named checks the whole workspace
      const all = await c.callTool({ name: "validate", arguments: {} });
      expect(all.isError).toBeFalsy();
      // checking files needs a prototype
      const files = await c.callTool({ name: "validate", arguments: { files: ["src/flows.ts"] } });
      expect(files.isError).toBe(true);
      expect(JSON.stringify(files.content)).toMatch(/Say which one/);
      // the shared contract needs no prototype
      expect((await c.callTool({ name: "list_components", arguments: {} })).isError).toBeFalsy();
    } finally {
      await c.close();
      rmSync(two, { recursive: true, force: true });
    }
  });
});

describe("server details", () => {
  it("reports this package's version and plain tool titles", async () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version: string };
    expect(client.getServerVersion()?.version).toBe(pkg.version);
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "validate")?.title).toBe("Check the prototypes");
    expect(tools.find((t) => t.name === "save_version")?.description).toContain("shares it if the workspace has a shared copy");
  });

  it("checks the contract and kit of a workspace with no prototypes yet", async () => {
    rmSync(join(root, "prototypes", "checkout"), { recursive: true, force: true });
    const r = await call("validate");
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/no prototypes yet/);
  });
});

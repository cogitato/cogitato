import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { GapLog } from "@cogitato/contract";
import { projectAt } from "@cogitato/kit-cli";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, resolveProject } from "../src/index.js";

const templateDir = fileURLToPath(new URL("../../../templates/prototype-react", import.meta.url));

let root: string;
let client: Client;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "cogitato-mcp-"));
  for (const part of ["src", "design", "package.json"]) cpSync(join(templateDir, part), join(root, part), { recursive: true });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(projectAt(root)).connect(a);
  client = new Client({ name: "test", version: "0" });
  await client.connect(b);
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
      ["add_state", "canvas_link", "create_screen", "get_component", "get_tokens", "list_components", "log_gap", "save_version", "set_status", "validate"].sort(),
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
    const flows = JSON.parse(readFileSync(join(root, "design/flows.json"), "utf8")) as { status?: Record<string, string> };
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

describe("resolveProject", () => {
  it("prefers KIT_PROJECT, then CLAUDE_PROJECT_DIR, then the working folder", () => {
    expect(resolveProject({ KIT_PROJECT: join(root, "src") }, tmpdir())?.root).toBe(root);
    expect(resolveProject({ CLAUDE_PROJECT_DIR: root }, tmpdir())?.root).toBe(root);
    expect(resolveProject({}, join(root, "design"))?.root).toBe(root);
    expect(resolveProject({}, tmpdir())).toBeUndefined();
  });
});

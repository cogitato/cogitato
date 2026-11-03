// Tests for the Claude Code plugin in /plugin. They live here because the plugin itself ships no
// package.json or dependencies (ADR 010), and its launchers start this package's server.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const plugin = join(repo, "plugin");
const templateDir = join(repo, "templates/prototype-react");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
const pluginPath = (p: string) => p.replace("${CLAUDE_PLUGIN_ROOT}", plugin);
const TOOLS = ["add_state", "canvas_link", "create_screen", "get_component", "get_tokens", "list_components", "log_gap", "save_version", "set_status", "validate"];

function frontmatter(text: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, "\n"));
  if (!m) return {};
  return Object.fromEntries(
    m[1]!.split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
    }),
  );
}

describe("plugin files", () => {
  it("has a manifest and a marketplace entry that point at each other", () => {
    expect(readJson(join(plugin, ".claude-plugin/plugin.json")).name).toBe("cogitato");
    const market = readJson(join(repo, ".claude-plugin/marketplace.json"));
    expect(market.plugins).toEqual([expect.objectContaining({ name: "cogitato", source: "./plugin" })]);
  });

  it("is turned on by the template's project settings, from this repo's marketplace", () => {
    const settings = readJson(join(templateDir, ".claude/settings.json"));
    const market = readJson(join(repo, ".claude-plugin/marketplace.json"));
    expect(settings.extraKnownMarketplaces[market.name].source).toMatchObject({ source: "github", repo: "JaffeJoseph/cogitato" });
    expect(settings.enabledPlugins).toEqual({ [`${market.plugins[0].name}@${market.name}`]: true });
    // A relative-path source is what lets project settings fetch the plugin without an install step.
    expect(market.plugins[0].source).toMatch(/^\.\//);
    for (const path of settings.extraKnownMarketplaces[market.name].source.sparsePaths) expect(existsSync(join(repo, path))).toBe(true);
  });

  it("runs hooks and the MCP server through scripts that exist, in exec form", () => {
    const hooks = readJson(join(plugin, "hooks/hooks.json")).hooks;
    expect(Object.keys(hooks).sort()).toEqual(["PostToolUse", "SessionStart"]);
    for (const groups of Object.values(hooks) as { hooks: { command: string; args: string[] }[] }[][]) {
      for (const h of groups.flatMap((g) => g.hooks)) {
        expect(h.command).toBe("node");
        expect(existsSync(pluginPath(h.args[0]!))).toBe(true);
      }
    }
    const kit = readJson(join(plugin, ".mcp.json")).mcpServers.kit;
    expect(existsSync(pluginPath(kit.args[0]))).toBe(true);
  });

  it("has skills with names, descriptions, and only real tools pre-approved", () => {
    const skills = readdirSync(join(plugin, "skills"));
    expect(skills.sort()).toEqual(["add-state", "new-prototype", "new-screen", "save-version", "setup-machine"]);
    for (const name of skills) {
      const fm = frontmatter(readFileSync(join(plugin, "skills", name, "SKILL.md"), "utf8"));
      expect(fm.name).toBe(name);
      expect(fm.description!.length).toBeGreaterThan(40);
      for (const tool of (fm["allowed-tools"] ?? "").split(/\s+/).filter(Boolean)) {
        expect(tool).toMatch(/^mcp__plugin_cogitato_kit__/);
        expect(TOOLS).toContain(tool.replace("mcp__plugin_cogitato_kit__", ""));
      }
    }
    expect(frontmatter(readFileSync(join(plugin, "skills/save-version/SKILL.md"), "utf8"))["disable-model-invocation"]).toBe("true");
  });
});

describe("plugin launchers", () => {
  let bare: string; // a prototype with nothing installed
  let other: string; // not a prototype at all
  beforeAll(() => {
    bare = mkdtempSync(join(tmpdir(), "cogitato-bare-"));
    for (const part of ["src", "design"]) cpSync(join(templateDir, part), join(bare, part), { recursive: true });
    other = mkdtempSync(join(tmpdir(), "cogitato-other-"));
  });
  afterAll(() => {
    rmSync(bare, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  });

  const hook = (event: string, dir: string, input: object = {}) => {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: dir };
    delete env.KIT_PROJECT;
    const r = spawnSync(process.execPath, [join(plugin, "scripts/kit-hook.mjs"), event], { input: JSON.stringify({ cwd: dir, ...input }), env, encoding: "utf8" });
    expect(r.status).toBe(0);
    return r.stdout.trim() ? (JSON.parse(r.stdout) as Record<string, any>) : undefined;
  };

  it("runs the prototype's own kit for the hooks", () => {
    expect(hook("post-edit", templateDir, { tool_name: "Edit", tool_input: { file_path: join(templateDir, "src/mocks/cart.ts") } })).toBeUndefined();
    const start = hook("session-start", templateDir);
    expect(start?.hookSpecificOutput.additionalContext).toContain("This is a Cogitato prototype: 4 screens, 8 states.");
  });

  it("offers setup when the prototype's parts aren't installed, and stays quiet elsewhere", () => {
    expect(hook("session-start", bare)?.systemMessage).toContain("Cogitato's tools aren't installed in this prototype yet");
    expect(hook("post-edit", bare, { tool_input: { file_path: join(bare, "src/flows.ts") } })).toBeUndefined();
    expect(hook("session-start", other)).toBeUndefined();
  });

  async function connect(dir: string) {
    const env = { ...(process.env as Record<string, string>), KIT_PROJECT: dir };
    const client = new Client({ name: "test", version: "0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(plugin, "scripts/kit-mcp.mjs")], env, cwd: dir }));
    return client;
  }

  it("starts the prototype's kit MCP server", async () => {
    const client = await connect(templateDir);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
    await client.close();
  }, 20_000);

  it("answers with no tools, and says why, when there's no server to start", async () => {
    for (const [dir, why] of [[bare, "aren't installed in this prototype yet"], [other, "isn't a Cogitato prototype"]] as const) {
      const client = await connect(dir);
      expect((await client.listTools()).tools).toEqual([]);
      expect(client.getInstructions()).toContain(why);
      await client.close();
    }
  }, 20_000);
});

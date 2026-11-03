#!/usr/bin/env node
// MCP server launcher. In a prototype with @cogitato/kit-mcp installed, it runs that server
// (the version the prototype pins). Otherwise it answers as a tiny MCP server with no tools, so
// Claude Code doesn't show a failed server, and its instructions say why there are no tools.
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { NOT_INSTALLED, findPrototype, installed, startDir } from "./lib.mjs";

const root = findPrototype(startDir());
const server = root ? installed(root, "kit-mcp", "bin/kit-mcp.js") : undefined;

if (server) {
  process.env.KIT_PROJECT = root;
  await import(pathToFileURL(server).href);
} else {
  const instructions = root
    ? NOT_INSTALLED
    : "This folder isn't a Cogitato prototype, so Cogitato's tools aren't available here.";
  const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
  for await (const line of createInterface({ input: process.stdin })) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id === undefined) continue; // notifications
    if (msg.method === "initialize") {
      send({
        id: msg.id,
        result: {
          protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "cogitato-kit", version: "0.0.0" },
          instructions,
        },
      });
    } else if (msg.method === "tools/list") send({ id: msg.id, result: { tools: [] } });
    else if (msg.method === "ping") send({ id: msg.id, result: {} });
    else send({ id: msg.id, error: { code: -32601, message: `Not available: ${instructions}` } });
  }
}

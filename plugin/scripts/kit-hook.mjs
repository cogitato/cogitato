#!/usr/bin/env node
// Claude Code hook launcher: `node kit-hook.mjs <post-edit|session-start>`, hook JSON on stdin.
// Runs the prototype's own `kit hook <event>` so the rules are the version the prototype pins.
// Outside a Cogitato prototype it does nothing. A failing kit never breaks the session: the hook
// then says nothing.
import { spawnSync } from "node:child_process";
import { NOT_INSTALLED, findPrototype, installed, startDir } from "./lib.mjs";

const event = process.argv[2];
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks).toString("utf8");
let data = {};
try {
  data = JSON.parse(input || "{}");
} catch {
  data = {};
}

const root = findPrototype(startDir(data));
if (root) {
  const kit = installed(root, "kit-cli", "bin/kit.js");
  if (!kit) {
    if (event === "session-start") {
      process.stdout.write(
        JSON.stringify({
          systemMessage: `Cogitato: ${NOT_INSTALLED}`,
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext:
              "This is a Cogitato prototype, but its packages aren't installed (no node_modules/@cogitato/kit-cli). " +
              "Offer the designer the Cogitato setup-machine skill, in plain words.",
          },
        }),
      );
    }
  } else {
    const r = spawnSync(process.execPath, [kit, "hook", event], { input, cwd: root, encoding: "utf8", timeout: 55_000 });
    if (r.status === 0 && r.stdout.trim()) process.stdout.write(r.stdout);
  }
}

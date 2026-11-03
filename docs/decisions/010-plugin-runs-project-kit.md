# ADR 010: Plugin hooks and MCP run the prototype's pinned kit

- **Status:** Accepted
- **Date:** 2026-11-02
- **Resolves:** the 04-claude-plugin open question on off-script requests

## Decision
- The plugin ships **no dependencies**, only two Node launchers in `plugin/scripts/`. Each walks up from the project folder to the one with `design/contract` and runs the prototype's installed kit:
  - **`kit-hook.mjs`** pipes Claude Code's hook JSON to `node_modules/@cogitato/kit-cli/bin/kit.js hook <event>` and passes its JSON output back.
  - **`kit-mcp.mjs`** imports `node_modules/@cogitato/kit-mcp/bin/kit-mcp.js`, a stdio MCP server.
- **Exec form** (`"command": "node"` plus `args` with `${CLAUDE_PLUGIN_ROOT}`) is used for every hook and the MCP server, so paths with spaces work and Windows doesn't need Git Bash.
- **Outside a prototype**, the hooks say nothing and the MCP launcher answers as an MCP server with no tools, so Claude Code doesn't report a broken server.
- **In a prototype without `node_modules`**, the session-start hook tells the designer in one line and offers the `setup-machine` skill.
- All hook logic is in kit-cli (`src/hook.ts`):
  - **`post-edit`** (PostToolUse on `Write|Edit`):
    - Checks prototype source under `src/` (except `src/kit/`) and files in `design/`.
    - Re-exports `flows.json` first when a screen or `src/flows.ts` changed, so it never goes stale.
    - Errors → `{"decision": "block", "reason": …}`: the designer-readable report with suggestions, plus advice to use the nearest token or log a gap. Warnings only → `additionalContext`.
    - Hand edits to the generated `flows.json` are blocked with an explanation.
  - **`session-start`** runs `doctor`. It gives Claude the prototype's shape and points it to the MCP tools. Setup problems become a one-line `systemMessage` for the designer.

## Off-script requests ("just make it red")
The edit hook can't undo a write, but blocking feeds the problem back to Claude in the same turn. The plugin's skills and the template's `CLAUDE.md` tell Claude to:
1. Explain the problem briefly.
2. Offer the nearest token or component (the validator's suggestion).
3. Log a gap with `log_gap` if the design really needs something new.

The designer is never left with hardcoded values that the build would fail on.

## Why
- **Same rules everywhere.** The rules that run are the version the prototype pins (ADR 006), for the designer, the developer and CI alike.
- **Logic stays testable.** Keeping the decisions in kit-cli makes them unit-testable. The launchers stay small enough to read in a minute.

## Consequences
- Hook latency is a Node start plus one `validate --files` (well under the 2 s budget).
- Plugin tests (in `packages/kit-mcp/test/plugin.test.ts`) run the launchers against the template, a prototype with nothing installed, and a non-prototype folder.

# Cogitato plugin for Claude Code

What Cogitato adds to Claude Code for designers, working in a design workspace: one design kit shared by every prototype in `prototypes/` ([04-claude-plugin.md](../docs/architecture/components/04-claude-plugin.md)).

- **Skills:**
  - `/cogitato:new-screen`, `/cogitato:add-state`: Claude also uses these on its own for plain requests like "add an expired-card state".
  - `/cogitato:save-version`: only when asked.
  - `/cogitato:setup-machine`.
  - `/cogitato:new-prototype`: adds another prototype to the design workspace.
- **Hooks:**
  - After every edit, the change is checked against the design contract, and problems go straight back to Claude to fix.
  - At session start, the machine and workspace are checked.
- **MCP server `kit`:** the contract and the scaffolding actions as tools (`mcp__plugin_cogitato_kit__*`). See [kit-mcp](../packages/kit-mcp).

The plugin has no dependencies of its own. Its launchers in `scripts/` run the kit installed in the workspace, and do nothing outside a Cogitato design workspace ([ADR 010](../docs/decisions/010-plugin-runs-project-kit.md)).

## Install
The repo root is the marketplace ([ADR 009](../docs/decisions/009-plugin-distribution.md)).
- **Designers:** nothing to do. Every workspace made from the template has a `.claude/settings.json` that declares the `cogitato/cogitato` marketplace and turns the plugin on. Claude Code fetches and loads it once the workspace folder is trusted. The repo is public, so no GitHub sign-in is needed.
- **By hand:**
  ```
  claude plugin install cogitato --marketplace cogitato/cogitato
  ```
- **For development:** `claude --plugin-dir /path/to/Cogitato/plugin`.

Check changes with `claude plugin validate ./plugin` and `claude plugin validate .` from the repo root, and bump `version` in `.claude-plugin/plugin.json` when releasing.

# @cogitato/kit-mcp

The kit MCP server ([05-kit-mcp.md](../../docs/architecture/components/05-kit-mcp.md)). It gives Claude Code structured access to a prototype's design contract and its scaffolding actions. It's a thin layer over `@cogitato/kit-cli`: every tool calls a kit-cli function.

| Tool | What it does |
|---|---|
| `list_components` | Kit components with usage notes and source badges |
| `get_component` | One component's props, states, rules, and the design rules that mention it |
| `get_tokens` | Tokens (optionally one group) with the `var(--kit-…)` to use |
| `create_screen` | New screen with a default state, optionally connected from an existing state |
| `add_state` | New state on a screen, optionally connected |
| `log_gap` | Records a missing component, token or pattern |
| `validate` | Plain-language check against the contract |
| `canvas_link` | The state's frame on the canvas, and the state on its own |
| `set_status` | Sets a state's review status on the canvas |
| `save_version` | Saves a version (used by the `save-version` skill) |

Tool errors (an id that's taken, a component that isn't in the kit) come back as plain sentences Claude can relay.

## Running it
The Cogitato plugin starts it from the prototype's own `node_modules`, so it matches the kit version the prototype pins ([ADR 010](../../docs/decisions/010-plugin-runs-project-kit.md)). By hand: `kit-mcp` over stdio in a prototype folder. It finds the prototype from `KIT_PROJECT`, then `CLAUDE_PROJECT_DIR`, then the working directory.

## Tests
- `test/server.test.ts` drives every tool through an in-memory MCP client on a copy of the template.
- `test/plugin.test.ts` checks the plugin's files and runs its launchers against the template, a prototype with nothing installed, and a folder that isn't a prototype.

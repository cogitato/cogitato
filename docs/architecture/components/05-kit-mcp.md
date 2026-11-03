# 05 · Kit MCP Server

**Package:** `packages/kit-mcp`  ·  **Phase:** 2

## Responsibility
Give Claude structured access to the contract and scaffolding actions, instead of relying on it to read files correctly.

## Tools
| Tool | Purpose |
|---|---|
| `list_components` | Names, source badges, one-line usage |
| `get_component` | Full manifest: props, states, rules |
| `get_tokens` | Tokens, optionally filtered by group |
| `create_screen` | Scaffold route + default fixture + `data-kit-id`s, registered in flows |
| `add_state` | Add a fixture to an existing screen |
| `log_gap` | Record a missing component/token with context |
| `validate` | Wraps `kit validate` |
| `canvas_link` | The state's frame on the canvas (`/__canvas?focus=`), and the state on its own |
| `set_status` | Sets a state's review status on the canvas (Phase 3) |
| `save_version` | Wraps `kit save`; used by the `save-version` skill only |

Thin wrapper over kit-cli libraries. Runs locally over stdio, launched by the plugin's MCP config.

## Decided
- `create_screen` writes the skeleton files and Claude fills in the UI ([ADR 011](../../decisions/011-scaffolding-and-saving.md)).
- The plugin starts the server from the prototype's own `node_modules`, so it matches the kit version the prototype pins ([ADR 010](../../decisions/010-plugin-runs-project-kit.md)).

## Done when
- Claude prefers MCP tools over grepping the contract in normal designer prompts (check in transcripts).

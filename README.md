# Cogitato

Coded prototypes that designers build with Claude Code, kept to their team's design system, reviewed on a live canvas, and handed off to developers as a spec their Claude Code can build from.

> Cogitato is a working name. Apache-2.0 licensed.

## Start a design workspace
Requires Node 22+ and pnpm.

```
npm create cogitato@latest acme-design
```

Open `acme-design` in Claude Code and describe what you want: "add a review screen before payment", "show what happens when the card is expired". The Cogitato plugin turns on when you trust the folder:
- Claude builds with the design kit only, and every edit is checked against the design contract.
- The canvas at `http://localhost:5173/__canvas` shows every screen state as a live frame, laid out as your flows.

A workspace starts with **Acme Shop**, an example design system in `design/contract/`. Swap in your team's own.

**Workspaces.** One repo per org holds the design kit and contract (`design/contract/`, `kit/`) once, and each prototype is a folder in `prototypes/<name>/`. Ask Claude for a new prototype and it adds a folder; one branch can change several prototypes ([ADR 017](docs/decisions/017-multi-prototype-workspace.md)).

## What's in this repo
| Path | What it is |
|---|---|
| [`packages/contract`](packages/contract) | JSON Schemas, generated types and validators for every shared format |
| [`packages/runtime`](packages/runtime) | What prototypes run on: screens, fixtures, frame mode, `/__kit`, `/__canvas`, the Vite plugin |
| [`packages/canvas`](packages/canvas) | The canvas: frames, flows, snapshots and review statuses |
| [`packages/kit-cli`](packages/kit-cli) | The `kit` command: validate, export flows, scaffold, status, snapshots, save |
| [`packages/kit-mcp`](packages/kit-mcp) | The MCP server that gives Claude the contract and scaffolding actions |
| [`packages/create-cogitato`](packages/create-cogitato) | `npm create cogitato` |
| [`templates/workspace-react`](templates/workspace-react) | The design workspace template (React, TypeScript, Vite): shared kit and contract, with the Acme Shop checkout as the first prototype |
| [`plugin`](plugin) | The Claude Code plugin: skills, edit and session hooks, MCP. This repo is its marketplace |

Everything here runs on one person's machine and is free. Team features (a shared canvas across branch previews, live comments, hosted previews, intake and handoff) are a separate hosted platform ([ADR 015](docs/decisions/015-open-core-and-hosted-platform.md)). Your prototypes and contracts always stay in your own repos.

## Docs
1. [Architecture overview](docs/architecture/overview.md)
2. [Shared interfaces](docs/architecture/interfaces.md): the file formats and conventions every part depends on
3. [Roadmap](docs/roadmap.md) and [decisions](docs/decisions/)

## Status
Phases 0–3 are built: contract, runtime, kit CLI, plugin and MCP server, canvas, and Netlify preview config. The 0.1.0 packages are on npm as `@cogitato/*`, and the plugin installs from this repo's marketplace. Design workspaces (a folder per prototype, ADR 017) are the first step of Phase 3's hosting work and ship as 0.2.0. Next after that is Phase 4: comments and the team canvas, in the platform.

## Develop
See [CONTRIBUTING.md](CONTRIBUTING.md).

```
pnpm install
pnpm build && pnpm typecheck && pnpm test
pnpm --filter @cogitato/template-checkout dev   # http://localhost:5173, kit at /__kit, canvas at /__canvas
```

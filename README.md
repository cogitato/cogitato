# Cogitato

Coded prototypes that designers build with Claude Code, kept to their team's design system, reviewed on a live canvas, and handed off to developers as a spec their Claude Code can build from.

> Cogitato is a working name. Apache-2.0 licensed.

## Start a prototype
Requires Node 22+ and pnpm.

```
npm create cogitato@latest my-prototype
```

Open `my-prototype` in Claude Code and describe what you want: "add a review screen before payment", "show what happens when the card is expired". The Cogitato plugin turns on when you trust the folder:
- Claude builds with the design kit only, and every edit is checked against the design contract.
- The canvas at `http://localhost:5173/__canvas` shows every screen state as a live frame, laid out as your flows.

New prototypes start with **Acme Shop**, an example design system in `design/contract/`. Swap in your team's own.

## What's in this repo
| Path | What it is |
|---|---|
| [`packages/contract`](packages/contract) | JSON Schemas, generated types and validators for every shared format |
| [`packages/runtime`](packages/runtime) | What prototypes run on: screens, fixtures, frame mode, `/__kit`, `/__canvas`, the Vite plugin |
| [`packages/canvas`](packages/canvas) | The canvas: frames, flows, snapshots and review statuses |
| [`packages/kit-cli`](packages/kit-cli) | The `kit` command: validate, export flows, scaffold, status, snapshots, save |
| [`packages/kit-mcp`](packages/kit-mcp) | The MCP server that gives Claude the contract and scaffolding actions |
| [`packages/create-cogitato`](packages/create-cogitato) | `npm create cogitato` |
| [`templates/prototype-react`](templates/prototype-react) | The prototype template (React, TypeScript, Vite), with the Acme Shop checkout |
| [`plugin`](plugin) | The Claude Code plugin: skills, edit and session hooks, MCP. This repo is its marketplace |

Everything here runs on one person's machine and is free. Team features (a shared canvas across branch previews, live comments, hosted previews, intake and handoff) are a separate hosted platform ([ADR 015](docs/decisions/015-open-core-and-hosted-platform.md)). Your prototypes and contracts always stay in your own repos.

## Docs
1. [Architecture overview](docs/architecture/overview.md)
2. [Shared interfaces](docs/architecture/interfaces.md): the file formats and conventions every part depends on
3. [Roadmap](docs/roadmap.md) and [decisions](docs/decisions/)

## Status
Phases 0–3 are built: contract, runtime, kit CLI, plugin and MCP server, canvas, and Netlify preview config. The [distribution phase](docs/roadmap.md) publishes them to npm. Next is Phase 4: comments and the team canvas, in the platform.

## Develop
See [CONTRIBUTING.md](CONTRIBUTING.md).

```
pnpm install
pnpm build && pnpm typecheck && pnpm test
pnpm --filter @cogitato/template-prototype-react dev   # http://localhost:5173, kit at /__kit, canvas at /__canvas
```

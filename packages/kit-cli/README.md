# @cogitato/kit-cli

The `kit` command: the deterministic engine behind Cogitato. Hooks, skills and the MCP server call into it ([02-kit-cli.md](../../docs/architecture/components/02-kit-cli.md)).

Run it anywhere inside a prototype; it finds the folder holding `design/contract`.

| Command | What it does |
|---|---|
| `kit validate [--contract] [--files a.tsx b.css] [--json]` | Contract, code and flows against the design contract. `--files` is the fast path for edit hooks. |
| `kit export-flows [--check] [--json]` | Writes `design/flows.json` from `src/screens/**/screen.tsx` and `src/flows.ts`, read statically. `--check` only reports whether the file is current. |
| `kit preview [--port n] [--no-open]` | Starts the prototype if it isn't running, then opens `/__kit`. |
| `kit doctor [--json] [--quiet]` | Node, pnpm, installed parts, contract, flows, dev server, `.env`. `--quiet` prints problems only. |
| `kit new-screen <id> [--title] [--route] [--from <step>] [--label]` | Creates `src/screens/<id>/screen.tsx` with a default state; `--from` adds an arrow to it. |
| `kit add-state <screen> <state> [--title] [--from <step>] [--label]` | Adds a state to a screen. |
| `kit add-edge <from> <to> [--label] [--flow]` | Connects two states in `src/flows.ts`. |
| `kit gap add --kind --name --context [--screen] [--workaround]` | Records a missing component, token or pattern in `gaps.json`. |
| `kit link <step> [--canvas]` | Local address of a state, or of its frame on the canvas. |
| `kit status <step> <status>` | Sets a state's review status (`exploring`, `in-review`, `approved`, `handed-off`) in `flows.json`. |
| `kit snapshots [--dist dist]` | Screenshots every state of the built prototype for the canvas. Best effort: needs Playwright and Chromium, and otherwise skips. |
| `kit save [--message]` | Saves a version: commit on a design branch, then push if there's a remote. |
| `kit hook <post-edit\|session-start>` | Claude Code hook (JSON on stdin), used by the plugin. |

Exit codes: 0 all good, 1 problems found (or a request kit refused, with a plain explanation), 2 couldn't run. Scaffolding edits files in place through the TypeScript parser and keeps their formatting ([ADR 011](../../docs/decisions/011-scaffolding-and-saving.md)). `--json` prints a `ValidationReport` (`@cogitato/contract`'s `report.schema.json`).

The rules and their codes are listed in [ADR 008](../../docs/decisions/008-token-css-and-validation-report.md). Every message is written for a designer, with a machine `suggestion` where there's an obvious fix.

## Library
```ts
import { findProject, validate, exportFlows } from "@cogitato/kit-cli";
const project = findProject()!;
const { ok, issues } = validate(project, { files: ["src/screens/cart/screen.tsx"] });
```

## Tests
`pnpm test` runs the rule unit tests, plus the template checks: it validates clean, its exported flows match the Phase 0 reference, and single-file validation is fast. It also runs the seeded bad prototypes in `test/fixtures/bad/`. Each is a set of edits to a temp copy of the template plus the codes they must produce, and message wording is snapshotted.

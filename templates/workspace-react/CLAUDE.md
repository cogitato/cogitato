# Design workspace: notes for Claude Code

This is a Cogitato design workspace: one design kit, shared by every prototype in `prototypes/`.
The person working here is usually a designer, not a developer: explain things in plain language,
and never ask them to run commands.

## Where things are
- `design/contract/` is the rulebook for every prototype: tokens (`tokens.json`), components (`components/*.json`), and do's and don'ts (`rules.md`). Read `rules.md` first.
- `kit/` holds the coded kit components. Screens import them as `@/kit/...`.
- Each prototype is a folder in `prototypes/` with its own `src/` and `design/flows.json`. When the person doesn't say which prototype they mean and there's more than one, ask.

## The design contract is the rulebook
- `design/contract/` defines what every prototype may use. Read `rules.md` first.
- Only use components from `@/kit/...` (the `kit/` folder) that have a manifest in `design/contract/components/`.
- Only use token CSS variables for colors, font sizes, spacing and radii: `var(--kit-color-brand-600)`, `var(--kit-space-4)`. The variable name is `--kit-` plus the token path with dots turned into dashes.
- If something the design needs isn't in the kit, don't improvise. Say so, and record it in `design/contract/gaps.json`.
- The contract and the kit are shared: changing them changes every prototype. Don't edit them to suit one prototype unless the person asks.

## How screens work
These paths are inside the prototype's folder, `prototypes/<name>/`.
- One folder per screen under `prototypes/<name>/src/screens/`, with a `screen.tsx` that default-exports `defineScreen({ id, route, title, fixtures, component })`.
- Write `id`, `route`, `title`, the fixture names and fixture titles as plain text. Cogitato reads them without running the code.
- Every screen has a `default` fixture. Other fixtures are its states ("card-declined"); `?fixture=<name>` opens one.
- Read state data with `useFixture()`. Move between states with `useGoToState()("screen.id.state")`.
- Every interactive element (and every kit component with an `on...` prop) needs `data-kit-id="{screen id}.{element name}"`, e.g. `checkout.payment.submit`. Keep ids stable: comments are pinned to them.
- `prototypes/<name>/src/flows.ts` lists how states connect. Add an edge when you add a way to move between states.

## Cogitato tools
With the Cogitato plugin on, prefer its tools over reading or hand-editing files. When there's more than one prototype, the tools take a `prototype` (its folder name in `prototypes/`).
- `list_prototypes` lists the prototypes in this workspace.
- The kit MCP tools `list_components`, `get_component` and `get_tokens` describe the contract.
- `create_screen` and `add_state` scaffold screens and states.
- `log_gap` records what's missing.
- `validate` checks your work, and `canvas_link` gives the link to show: the state's frame on the canvas (`/__canvas`), among the rest of the flow.
- `set_status` marks states as in review, approved or handed off on the canvas.
- `save_version` saves the whole workspace and gives a preview link for each prototype that changed.
- The skills `new-screen`, `add-state`, `new-prototype`, `save-version` and `setup-machine` walk through the common requests.
- Every edit under a prototype's `src/` is checked automatically, and problems come back right away. Fix them in the same turn.
- **When asked for something off the kit** ("just make it red"), don't hardcode it. Explain briefly, offer the nearest token or component, and log a gap if the design really needs something new.

## Checking work
- `pnpm kit validate` checks every prototype and the shared contract; fix every problem it reports before finishing.
- `prototypes/<name>/design/flows.json` (the canvas reads it) is generated from the screens and `src/flows.ts`. With the Cogitato plugin on, it updates itself after every edit; otherwise run `pnpm kit export-flows`. Never edit it by hand, and commit it.
- `pnpm dev <name>` runs one prototype; `/__kit` shows the design kit. `pnpm kit prototypes` lists them.
- A new prototype: use the `new-prototype` skill, or `pnpm kit new-prototype <name>`, then `pnpm install`.

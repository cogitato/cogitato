# Prototype: notes for Claude Code

This is a Cogitato prototype. The person working here is usually a designer, not a developer:
explain things in plain language, and never ask them to run commands.

## The design contract is the rulebook
- `design/contract/` defines what this prototype may use: tokens (`tokens.json`), components (`components/*.json`), and do's and don'ts (`rules.md`). Read `rules.md` first.
- Only use components from `@/kit/...` that have a manifest in `design/contract/components/`.
- Only use token CSS variables for colors, font sizes, spacing and radii: `var(--kit-color-brand-600)`, `var(--kit-space-4)`. The variable name is `--kit-` plus the token path with dots turned into dashes.
- If something the design needs isn't in the kit, don't improvise. Say so, and record it in `design/contract/gaps.json`.

## How screens work
- One folder per screen under `src/screens/`, with a `screen.tsx` that default-exports `defineScreen({ id, route, title, fixtures, component })`.
- Write `id`, `route`, `title`, the fixture names and fixture titles as plain text. Cogitato reads them without running the code.
- Every screen has a `default` fixture. Other fixtures are its states ("card-declined"); `?fixture=<name>` opens one.
- Read state data with `useFixture()`. Move between states with `useGoToState()("screen.id.state")`.
- Every interactive element (and every kit component with an `on...` prop) needs `data-kit-id="{screen id}.{element name}"`, e.g. `checkout.payment.submit`. Keep ids stable: comments are pinned to them.
- `src/flows.ts` lists how states connect. Add an edge when you add a way to move between states.

## Cogitato tools
With the Cogitato plugin on, prefer its tools over reading or hand-editing files:
- The kit MCP tools `list_components`, `get_component` and `get_tokens` describe the contract.
- `create_screen` and `add_state` scaffold screens and states.
- `log_gap` records what's missing.
- `validate` checks your work, and `canvas_link` gives the link to show: the state's frame on the canvas (`/__canvas`), among the rest of the flow.
- `set_status` marks states as in review, approved or handed off on the canvas.
- The skills `new-screen`, `add-state`, `save-version` and `setup-machine` walk through the common requests.
- Every edit under `src/` is checked automatically, and problems come back right away. Fix them in the same turn.
- **When asked for something off the kit** ("just make it red"), don't hardcode it. Explain briefly, offer the nearest token or component, and log a gap if the design really needs something new.

## Checking work
- `pnpm kit validate` checks everything; fix every problem it reports before finishing.
- `design/flows.json` (the canvas reads it) is generated from the screens and `src/flows.ts`. With the Cogitato plugin on, it updates itself after every edit; otherwise run `pnpm kit export-flows`. Never edit it by hand, and commit it.
- `pnpm dev` runs the prototype; `/__kit` shows the design kit.

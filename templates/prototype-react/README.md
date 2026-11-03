# Your prototype

A coded prototype made with [Cogitato](https://github.com/cogitato/cogitato): real screens and states, built from plain-language requests in Claude Code and kept to your team's design system.

## Working on it
- Open this folder in Claude Code and describe what you want: "add a review screen before payment", "show what happens when the card is expired". If anything's missing on this computer, Claude offers to set it up.
- **See every screen:** the canvas at http://localhost:5173/__canvas shows each state as a frame, laid out as your flows. The design kit is at `/__kit`.
- **Save a version:** ask Claude to "save a version". Your work goes on your own design branch.

## The design system
`design/contract/` is the rulebook: tokens, components and do's and don'ts. This prototype starts with **Acme Shop**, an example design system, so there's something to build with right away.

To use your team's own design system, replace `design/contract/` and the matching components in `src/kit/`. Then run `pnpm kit validate` to check the result. (Generating a contract from your existing code, Figma or brand docs is coming.)

## For developers
- `pnpm dev`: the prototype, with the canvas and kit pages.
- `pnpm kit validate`: checks code and contract against the design system.
- `pnpm build`: a production build in `dist/`, with snapshots for the canvas (needs `npx playwright install chromium` once).
- `netlify.toml` deploys a preview per branch, with its canvas at `/__canvas`.

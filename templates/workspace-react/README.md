# Your design workspace

A design workspace made with [Cogitato](https://github.com/cogitato/cogitato): one design kit, shared by every prototype. Prototypes are real, coded screens and states, built from plain-language requests in Claude Code and kept to your team's design system.

## What's in it
- `design/contract/`: the rulebook for every prototype: tokens, components and do's and don'ts.
- `kit/`: the coded kit components the prototypes build with.
- `prototypes/<name>/`: one folder per prototype, each with its own screens, flows and settings. It starts with `checkout`.

## Working on it
- Open this folder in Claude Code and describe what you want: "add a review screen before payment", "show what happens when the card is expired". If anything's missing on this computer, Claude offers to set it up. With more than one prototype, say which one you mean.
- **Add a prototype:** ask Claude ("start a new prototype for onboarding"), or run `pnpm kit new-prototype <name>` and then `pnpm install`. It shares the same design kit.
- **See a prototype:** `pnpm dev <name>`. The canvas at http://localhost:5173/__canvas shows each state as a frame, laid out as your flows. The design kit is at `/__kit`.
- **Save a version:** ask Claude to "save a version". Your work goes on your own design branch, and you get a preview link for each prototype that changed.

## The design system
`design/contract/` and `kit/` are the design system. They start as **Acme Shop**, an example, so there's something to build with right away.

To use your team's own, replace `design/contract/` and the matching components in `kit/`. Then run `pnpm kit validate` to check every prototype against it. (Generating a contract from your existing code, Figma or brand docs is coming.)

## For developers
- `pnpm dev <name>`: one prototype, with the canvas and kit pages. `pnpm kit prototypes` lists them.
- `pnpm kit validate`: checks every prototype, and the contract, against the design system. `pnpm kit validate --prototype <name>` checks one.
- `pnpm build`: a production build of each prototype in its `dist/`, with snapshots for the canvas (needs `npx playwright install chromium` once).

### Hosting previews
Each prototype is deployed on its own, one preview per branch, with its canvas at `/__canvas`.
- **Cogitato-hosted:** set the preview address in the root `package.json`:
  ```json
  "kit": { "previewUrl": "https://{host}.<preview domain>", "org": "<org>" }
  ```
- **Self-hosted on Netlify:** make one site per prototype and set its base directory to `prototypes/<name>`. Each prototype folder has the `netlify.toml` it needs.

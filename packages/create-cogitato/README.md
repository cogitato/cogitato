# create-cogitato

Start a new [Cogitato](https://github.com/cogitato/cogitato) design workspace:

```
npm create cogitato@latest my-design
```

It copies the workspace template into `my-design/` (a design kit, a contract, and one example prototype in `prototypes/checkout/`), pinned to this release of the `@cogitato/*` packages, then installs it (if pnpm is available) and starts its git history. Usually there is one workspace per team or company. Then open the folder in Claude Code and describe your first screen, or ask for a new prototype.

Options (after `--` with npm): `--no-install`, `--no-git`.

The template starts with the Acme Shop example design kit in `design/contract/` and `kit/`. Replace it with your team's contract and kit components when you're ready.

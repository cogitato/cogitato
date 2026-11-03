# create-cogitato

Start a new [Cogitato](https://github.com/JaffeJoseph/cogitato) prototype:

```
npm create cogitato@latest my-prototype
```

It copies the prototype template into `my-prototype/`, pinned to this release of the `@cogitato/*` packages, then installs it (if pnpm is available) and starts its git history. Then open the folder in Claude Code and describe your first screen.

Options (after `--` with npm): `--no-install`, `--no-git`.

The template starts with the Acme Shop example design system in `design/contract/`. Replace it with your team's contract and kit components when you're ready.

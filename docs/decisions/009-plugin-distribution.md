# ADR 009: The Cogitato repo is the plugin marketplace

- **Status:** Accepted. The private-repo parts are superseded by [ADR 016](016-naming-and-distribution.md): the marketplace is the public Cogitato repo, so no credentials are needed.
- **Date:** 2026-11-02
- **Resolves:** open decision #5

## Decision
- The Claude Code plugin lives in `plugin/`, and this repo is its marketplace: `.claude-plugin/marketplace.json` at the root, named `cogitato`, with one plugin `cogitato` whose source is `./plugin`.
- For the pilot the repo is the **private GitHub repo [JaffeJoseph/cogitato](https://github.com/JaffeJoseph/cogitato)**.
- The prototype template ships `.claude/settings.json`:
  - It declares the marketplace under `extraKnownMarketplaces`: a GitHub source with `sparsePaths` limited to `.claude-plugin` and `plugin`, and `autoUpdate: true`.
  - It turns the plugin on with `enabledPlugins: { "cogitato@cogitato": true }`.
- **No install step for designers:**
  - Claude Code normally doesn't fetch a plugin that only project settings enable. It does when the marketplace entry has a relative-path source, which ours does (`./plugin`).
  - So after a designer accepts the workspace trust dialog for the prototype folder, Claude Code clones the marketplace and loads the plugin.
- **Requirements and limits:**
  - Each designer needs read access to the private repo through git credentials already on their machine (for example `gh auth login`). Claude Code never prompts for them.
  - Cloud sessions don't add repository-declared marketplaces.
- Developers working on the plugin itself load it with `claude --plugin-dir ./plugin`.

## Why
- One repo means the plugin, the kit packages and the docs version together. A plugin change and the kit change it depends on land in the same commit.
- The public marketplace can come later. Nothing in the plugin is team-specific; the team-specific part is the contract inside each prototype.

## Consequences
- The plugin version in `plugin/.claude-plugin/plugin.json` must be bumped for users to get updates. Claude Code pins installs to it, and auto-update only picks up a new version string.
- `claude plugin validate ./plugin` and `claude plugin validate .` are part of checking a plugin change.

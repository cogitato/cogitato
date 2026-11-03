# ADR 016: Cogitato, brand at the edges, and how it's distributed

- **Status:** Accepted. The name is provisional.
- **Date:** 2026-11-02
- **Resolves:** open decisions #13 (license) and #16 (npm scope); carries out the distribution phase of [ADR 015](015-open-core-and-hosted-platform.md)

## Context
ADR 015 makes the local tool open source. Publishing needed three things settled:
- a name, because the `@protokit` npm scope belongs to someone else and "Protokit" is used by another project;
- a license;
- a way to start a prototype outside this repo.

## Decision

### Name: Cogitato, with the brand only at the edges
- The product is **Cogitato** "for now". On 2026-11-02 the npm scope `@cogitato`, `create-cogitato` and `cogitato` were all free.
- The name appears only where people see it:
  - the npm scope;
  - the plugin and marketplace name (`cogitato@cogitato`, tools `mcp__plugin_cogitato_kit__*`);
  - prose and messages.
- Everything inside is brand-free, so a future rename touches only those edges:

| Convention | Name |
|---|---|
| Prototype folder (contract, flows, annotations, handoff) | `design/` (`design/contract/`, `design/flows.json`) |
| Token CSS variables | `--kit-<token path>` |
| Cogitato's own UI classes | `kit-ui-*`, `kit-canvas-*` |
| Frame bridge messages | `kit:state`, `kit:rects`, `kit:hover`, `kit:select` |
| Frame attributes | `data-kit-id`, `data-kit-ready`, `data-kit-chrome` |
| Data URLs in a running or built prototype | `/__kit-data/flows.json`, `/__kit-data/snapshots.json`, `/__kit-data/status` |
| Vite plugin and virtual modules | `kit()` from `@cogitato/runtime/vite`; `virtual:kit/tokens.css`, `virtual:kit/kit` |
| Environment variable for the plugin's MCP server | `KIT_PROJECT` |
| Schema `$id`s | `https://kit.local/schema/*` |
| Prototype `package.json` hosting key | `"kit": { "previewUrl": … }` |

- This renamed folder and URL conventions in `interfaces.md` without bumping any `schemaVersion`. File shapes didn't change, and nothing had been published.

### License: Apache 2.0, with DCO sign-off
- `LICENSE` is at the root and copied into every published package. Every `package.json` and the plugin manifest say `Apache-2.0`.
- Contributors sign off commits (DCO, `git commit -s`; see `CONTRIBUTING.md`). A CLA comes up only if dual licensing does (#17).

### Packages and releases
- **Published:** `@cogitato/contract`, `runtime`, `canvas`, `kit-cli`, `kit-mcp`, and `create-cogitato`, on public npm.
- **One version:** they form one **fixed** Changesets group. A prototype pins one version for everything, and `create-cogitato`'s version is the version it pins.
- **`.github/workflows/release.yml`:**
  - Pending changesets open a "Version packages" PR on `main`, and merging it stages the new version.
  - A manual **canary** run stages `0.0.0-canary-<commit>` under the `canary` dist-tag, for the platform repo.
- **Staged publishing:** CI never makes anything public. `pnpm release:stage` (`pnpm stage publish -r`) uploads each new version to npm, which holds it out of sight. A maintainer runs `pnpm release:approve`, which lists what's staged and, after a yes and npm's 2FA, approves the six packages dependencies first. A stolen CI run can stage at most; it can't ship.
- **Signing in to npm:** CI stages through npm trusted publishing (GitHub OIDC from `release.yml`), with no npm token. Each package's trusted-publisher settings allow staging only, not direct publishing. The first 0.1.0 publish was done by hand, because npm only lets you set up trusted publishing on a package that exists.
- **`.github/workflows/ci.yml`** builds, typechecks and tests on every PR. It also checks that generated types are current, that the template build changes nothing committed, and that each package ships the right files (`scripts/check-packages.mjs`).

### Starting a prototype: `npm create cogitato@latest <folder>`
- `create-cogitato` carries the template, bundled at build time from `templates/prototype-react`. The template stays the single source of truth and keeps `workspace:*` inside the monorepo.
- Bundling pins every `workspace:*` dependency to `^<version>`, drops our license and description, removes the `flows.json` commit, and ships `.gitignore` as `_gitignore`, because npm strips it.
- Creating a prototype copies the template, renames the package after the folder, installs with pnpm if it's there, and starts git history.
- The plugin's `new-prototype` skill runs it for designers.
- The template still starts with the Acme Shop example contract. A company's own contract comes from intake (Phase 5) or by hand.

### Repos
- The open code moves to a **fresh public repo** made from one commit of the current tree, authored with a GitHub noreply address. This private repo keeps the full history and is archived.
- The public repo is the plugin marketplace. The template's `.claude/settings.json` points at it, so the plugin installs for anyone, which supersedes the private-repo part of [ADR 009](009-plugin-distribution.md).
- The platform lives in a separate private repo (ADR 015) that depends on the published packages, or on canaries.

## Consequences
- The repo owner in package metadata, the template settings and docs is `JaffeJoseph/cogitato`. Change it everywhere if the public repo lands under an organization.
- Renaming the product later means changing:
  - the npm scope and the `create-` package;
  - the plugin and marketplace names;
  - prose.

  Prototypes' files, URLs and CSS stay the same.

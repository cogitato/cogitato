# ADR 017: A design workspace per org, a folder per prototype

- **Status:** Accepted
- **Date:** 2026-11-12
- **Relates to:** ADR 015 (open core), ADR 016 (naming); platform ADR 001 (hosted previews)

## Context
Until 0.1.0, a repo was one prototype with its own copy of the design kit. Companies make many
prototypes from one kit, and designers shouldn't need to create repos. Hosted previews (platform
ADR 001) build from an org's repo, so the layout is also what the platform reads.

## Decision
- One repo per org, a **design workspace**: `design/contract/` and `kit/` at the root, shared by
  every prototype; each prototype is `prototypes/<name>/` with its own `src/`, `design/flows.json`
  and `package.json` (a pnpm workspace package).
- Work happens on a branch per piece of work (`design/<name>-<date>`); one branch may change several
  prototypes. Who made what comes from git.
- `kit-cli` has two roots: the workspace and the prototype. Commands take `--prototype` (MCP tools
  take `prototype`) when it isn't clear from where you are.
- `kit-cli/hosting` exports `previewHost` (`<branch>--<prototype>--<org>`, one DNS label, hashed
  when over 63 characters) and `affectedPrototypes` (changes to `design/`, `kit/`, the root
  `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` affect every prototype).
- Preview links come from `"kit": { "previewUrl": "https://{host}.<domain>", "org": "<org>" }` in the
  workspace's `package.json`.
- One layout only: the 0.1.0 single-prototype layout isn't supported. No file format changes, so no
  `schemaVersion` bump.

## Consequences
- 0.2.0 is a breaking change for 0.1.0 repos (only our own test repos). Moving one: put the
  prototype's `src/`, `design/flows.json`, `index.html`, configs and `package.json` under
  `prototypes/<name>/`, move `src/kit/` to `kit/`, and add the root `package.json` and
  `pnpm-workspace.yaml` from the template.
- Netlify is dropped (ADR 013 is superseded): the root `netlify.toml` (the Acme demo) and the
  template's `netlify.toml` are removed. The demo becomes a customer-style repo in its own GitHub
  org, with previews from the platform.

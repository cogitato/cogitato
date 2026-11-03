# ADR 015: Open core locally, paid platform for teams

- **Status:** Proposed. The direction is accepted; the license (#13) and pricing unit (#15) are still open.
- **Date:** 2026-11-02

## Context
Designers from many companies will use Cogitato. Their prototypes must never live in this repo. We also need a business model that doesn't fight the architecture. The architecture already separates what runs on one person's machine from what needs a server and several people. This ADR makes that line the product line.

## Decision

### What's open and free
Everything one designer needs on their own machine:
- **Packages:** `@cogitato/contract`, `runtime`, `canvas`, `kit-cli` and `kit-mcp`.
- **The prototype template.**
- **The Claude Code plugin:** skills, hooks and the local MCP server.
- **The local canvas** at `/__canvas`: view frames, flows and snapshots, and set statuses that are saved in git (ADR 012, ADR 014).

### What's paid
Anything that needs a server, other people, or a company account:
- **Team canvas:** one site showing every branch preview of a prototype, with a branch picker, version history, and statuses anyone on the team can change.
- **Comments and annotations** (Phase 4): live, anchored, version-aware.
- **Hosted previews:** a GitHub App builds every branch of a company's prototype repos and hosts it with access control. This replaces "each company connects Netlify" and "previews are public" (ADR 013 stays as the self-hosted path).
- **Intake** (Phase 5) and **handoff** (Phase 6): contract creation from a company's sources, and specs that include resolved comments, decisions and gaps.
- **Org features:** SSO, roles, audit, and gap reports across prototypes.

### Rules that keep the line clean
1. **No paid logic in the open packages.** Nothing in the open code is held back by a license key or flag. Paid features run on our servers.
2. **The local canvas stays single-user.** Collaboration features (comments, presence, shared status changes, the branch picker) are built only into the hosted canvas. Both use `@cogitato/canvas` underneath, so this is a product choice, not a fork.
3. **One plugin, optionally connected.**
   - The public plugin works fully without an account.
   - It gains an optional connection to the platform: a remote MCP server or API, configured through the plugin's `userConfig` with a token stored as sensitive.
   - When connected, `save_version` returns the hosted preview, and platform tools appear (for example "address open comments", "prepare handoff").
4. **Customer work never lives in Cogitato's repos.**
   - Each company keeps its contract and prototypes in its own repos and GitHub organization.
   - Designer branches exist only there.
   - The platform reads those repos through the GitHub App and stores only what it needs (comments, preview builds), scoped per company.
5. **Everything stays usable without us.** Prototypes, contracts, flows and statuses are plain files in the customer's git. Leaving the platform loses comments and hosting, not work (principle 5).

### Repos
- **This repo becomes the public, open-source repo:** packages, template, plugin and docs.
  - The plugin marketplace moves to a public repo, or this repo once it's public. Then the template's `.claude/settings.json` (ADR 009) works for anyone.
  - The packages are published to public npm.
  - The root `netlify.toml` stays only as our own Acme demo.
- **A new private repo holds the platform:** the hosted team canvas app, comment service, preview builder (GitHub App), intake and handoff services, accounts, and billing.
  - It depends on the published open packages, like any customer does.
  - It must exist before Phase 4 work starts, because the comment service is its first piece.

## Why
- **Adoption needs a free path.** A designer trying Cogitato alone needs everything locally at no cost, and that's how it spreads inside a company.
- **Teams pay for the shared parts.** Review, collaboration and handoff across people are the parts a team values and can't run themselves without effort, and they're the parts that need servers anyway.
- **Hosted is hard to copy.** Open code with hosted paid features is harder to undercut by self-hosting than paid features hidden behind flags in open code.

## Consequences
- **Phase 4 changes shape.** The comment service and team canvas are built in the private platform repo. They're multi-tenant from day one: organization workspaces, sign-in tied to the customer's GitHub org (#9), and data scoped per organization.
- **A distribution phase comes before Phase 4** (roadmap):
  - publish the packages to public npm with versioned releases;
  - make the template stand-alone (pinned versions, a create command);
  - make the plugin marketplace public.
- **Open code needs a license before it's public** (#13).
- **The dev status endpoint and local canvas stay as they are.** Hosted status editing comes with platform sign-in.
- **Designers without GitHub accounts** can only save versions through a platform-backed path. That's a possible paid feature, decided with #14.

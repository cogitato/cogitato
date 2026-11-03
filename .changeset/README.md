# Changesets

Every change that should reach npm comes with a changeset: run `pnpm changeset`, pick the bump, and describe the change for people using Cogitato. All `@cogitato/*` packages and `create-cogitato` are versioned together (one version for everything a prototype pins).

On `main`, the release workflow opens a "Version packages" PR; merging it publishes to npm. See [ADR 016](../docs/decisions/016-naming-and-distribution.md).

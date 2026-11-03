# Contributing to Cogitato

Thanks for helping. Cogitato is Apache-2.0 licensed.

## Sign your commits (DCO)
Every commit needs a `Signed-off-by` line certifying the [Developer Certificate of Origin](https://developercertificate.org/): you wrote the change, or have the right to submit it under this project's license. Add it with:

```
git commit -s
```

## Working on it
Requires Node 22+ and pnpm.

```
pnpm install
pnpm build && pnpm typecheck && pnpm test
pnpm --filter @cogitato/template-prototype-react dev   # http://localhost:5173, canvas at /__canvas
```

Read [`CLAUDE.md`](CLAUDE.md) and the [architecture docs](docs/architecture/overview.md) before larger changes. File formats in [`interfaces.md`](docs/architecture/interfaces.md) are contracts between packages: change one only together with its schema, `schemaVersion` and every consumer. Decisions are recorded as ADRs in [`docs/decisions/`](docs/decisions).

## Releasing a change
If your change should reach npm, add a changeset: `pnpm changeset`, pick the bump, and describe it for people using Cogitato. All packages share one version. Merging the "Version packages" PR publishes them.

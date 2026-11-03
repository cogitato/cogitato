# ADR 014: Frame review status lives in flows.json

- **Status:** Accepted
- **Date:** 2026-11-02

## Decision
- **Where it's stored:** each state's review status uses the `status` map that `flows.schema.json` already defines. It maps `nodeRef` to `exploring`, `in-review`, `approved` or `handed-off`. `exploring` is the default and isn't written. No new file format.
- **How it's set:** only through kit-cli's `setStatus`.
  - `kit status <node> <status>`.
  - The `set_status` MCP tool ("mark the payment states as ready for review").
  - The canvas, while running locally, via `POST /__kit-data/status` on the dev server. That endpoint loads the prototype's own kit-cli.
- **How it survives exports:** `kit export-flows` keeps the status of nodes that still exist and drops the rest. Staleness checks (`sameManifest`) ignore `status`, because it's set on the canvas, not derived from code. Writes and `kit save` do compare it, so a status change is saved and described ("Mark checkout.payment.card-declined in review").
- **Hosted previews** show status read-only until Phase 4 adds sign-in.

## Why
- Plain files in git (principle 5): a status travels with the version it describes, and saving a version shares it.
- Reusing the existing field avoids another format and another file for the canvas to fetch.

## Consequences
- Status changes from the canvas are local until saved. On a shared branch, two people changing statuses merge like any other file change.
- `flows.json` is still generated, and hand edits are still blocked by the edit hook. Status changes go through kit, which writes the file.

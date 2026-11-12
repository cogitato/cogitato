---
"@cogitato/contract": minor
---

Design workspaces: one design kit (`design/contract/`, `kit/`) shared by a folder per prototype (`prototypes/<name>/`). `npm create cogitato` makes a workspace; `kit new-prototype`, `kit prototypes`, `kit dev` and `--prototype` are new; `kit save` links a preview per changed prototype; `@cogitato/kit-cli/hosting` exports `previewHost` and `affectedPrototypes`. Breaking for 0.1.0 repos: see ADR 017.

---
"@cogitato/contract": minor
"@cogitato/runtime": minor
"@cogitato/canvas": minor
"@cogitato/kit-cli": minor
"@cogitato/kit-mcp": minor
"create-cogitato": minor
---

Design workspaces: one design kit (`design/contract/`, `kit/`) shared by a folder per prototype (`prototypes/<name>/`). `npm create cogitato` makes a workspace; `kit new-prototype`, `kit prototypes`, `kit dev` and `--prototype` are new; `kit save` links a preview per changed prototype; `@cogitato/kit-cli/hosting` exports `previewHost` and `affectedPrototypes`. See ADR 017.

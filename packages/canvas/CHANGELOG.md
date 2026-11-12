# @cogitato/canvas

## 0.2.0

### Minor Changes

- 6bbb38b: Design workspaces: one design kit (`design/contract/`, `kit/`) shared by a folder per prototype (`prototypes/<name>/`). `npm create cogitato` makes a workspace; `kit new-prototype`, `kit prototypes`, `kit dev` and `--prototype` are new; `kit save` links a preview per changed prototype; `@cogitato/kit-cli/hosting` exports `previewHost` and `affectedPrototypes`. See ADR 017.

### Patch Changes

- Updated dependencies [af84375]
- Updated dependencies [6bbb38b]
  - @cogitato/contract@0.2.0

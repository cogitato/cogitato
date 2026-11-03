# 04 · Claude Code Plugin

**Location:** `plugin/` (+ marketplace manifest at repo root)  ·  **Phase:** 2 (building skills), 5 (intake), 6 (handoff)

## Responsibility
How Cogitato shows up inside Claude Code for both designers and developers.

## Structure
```
plugin/
  .claude-plugin/plugin.json
  skills/
    setup-machine/SKILL.md
    new-screen/SKILL.md
    add-state/SKILL.md
    annotate/SKILL.md
    save-version/SKILL.md
    prepare-handoff/SKILL.md
    intake/SKILL.md            # developer
    implement-handoff/SKILL.md # developer
  agents/
    contract-auditor.md
    reviewer.md
  hooks/hooks.json
  .mcp.json                    # registers the kit MCP server
```
Verify exact file names and hook event names against current Claude Code plugin docs before building.

## Hooks
- After file edits/writes in `src/`: run `kit validate --files <changed>`; return designer-readable failures so Claude fixes them in the same turn.
- Session start: run `kit doctor` quietly; if unhealthy, tell the designer in one line and offer `setup-machine`.

## Skill design rules
- Written for a non-technical user: confirm in plain language, never ask the designer to run commands.
- Every building skill ends by running validation and returning the local canvas link.
- `save-version` hides git: stage, commit with a generated message, push to the designer's branch, report the preview link.

## Decided
- Distribution: this repo is the marketplace, a private GitHub repo for the pilot ([ADR 009](../../decisions/009-plugin-distribution.md)).
- Off-script requests ("just make it red"): the edit hook blocks, and Claude explains, offers the nearest token, or logs a gap ([ADR 010](../../decisions/010-plugin-runs-project-kit.md)).
- Hooks and the MCP server run the prototype's own pinned kit through dependency-free launchers ([ADR 010](../../decisions/010-plugin-runs-project-kit.md)).

## Built in Phase 2
`setup-machine`, `new-screen`, `add-state` and `save-version`, the two hooks, and the kit MCP server. `annotate`, `prepare-handoff`, `intake`, `implement-handoff` and the agents come in later phases.

## Done when
- A designer with no terminal use can go from "new screen for X" to a validated screen on the local canvas.

---
name: new-prototype
description: Start a new prototype in this design workspace, next to the others and sharing their design kit. Use when the designer wants a new prototype or project, not more screens in the current one.
when_to_use: 'For example "start a new prototype for the onboarding flow", "I want a fresh prototype for the settings redesign".'
argument-hint: "[what the prototype is for]"
---

# Start a new prototype

The person is usually a designer. You run every command yourself, and explain each step in one plain line.

Request: $ARGUMENTS

1. **Name it.** Pick a short name from what it's for, in lowercase with dashes (`onboarding`, `account-settings`), and confirm it in one sentence. Check `list_prototypes` so it isn't taken.
2. **Create it** with `pnpm kit new-prototype <name>` in the workspace root. It adds `prototypes/<name>/` with the same setup as the others and an empty Home screen.
3. **Install its parts** with `pnpm install` in the workspace root.
4. **Hand over:** tell the designer it's ready and uses the team's design kit, give the canvas link from `canvas_link` with `prototype: "<name>"` and step `home`, and ask what the first screen should be.

If this folder isn't a Cogitato workspace at all, there's no workspace to add to yet: create one with `npm create cogitato@latest <folder>` next to the current folder, and tell the designer to open it in Claude Code.

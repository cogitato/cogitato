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
4. **Start it.** Start `pnpm dev <name>` in the workspace root in the background, the way the setup-machine skill starts a prototype. Wait until it prints its local address (usually http://localhost:5173, or the next port if another prototype is already running).
5. **Hand over:** tell the designer it's ready and uses the team's design kit, give them the address it printed with `/__canvas` on the end to see it on the canvas, and ask what the first screen should be.

If this folder isn't a Cogitato workspace at all, there's no workspace to add to yet: create one with `npm create cogitato@latest <folder>` next to the current folder, and tell the designer to open it in Claude Code.

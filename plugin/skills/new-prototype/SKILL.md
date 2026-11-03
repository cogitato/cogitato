---
name: new-prototype
description: Start a brand-new Cogitato prototype in its own folder, ready to open in Claude Code. Use when the designer wants to start a new prototype or project, not add to the current one.
when_to_use: 'For example "start a new prototype for the onboarding flow", "I want a fresh project for the settings redesign", "create a new Cogitato prototype".'
argument-hint: "[what the prototype is for]"
---

# Start a new prototype

The person is usually a designer. You run every command yourself, and explain each step in one plain line.

Request: $ARGUMENTS

1. **Name it.** Pick a short folder name from what it's for, in lowercase with dashes (`onboarding-flow`), and confirm it in one sentence.
2. **Pick where.** Put it next to the current folder, not inside it: a prototype inside another prototype confuses the tools. If the current folder isn't a prototype, put it here. Check the folder doesn't already exist.
3. **Create it** with `npm create cogitato@latest <folder>`.
   - This copies the prototype template, installs its parts, and starts its history.
   - If `npm` isn't there, Node.js is missing. Offer the setup-machine skill first.
4. **Hand over:**
   - Tell the designer it's ready.
   - Say it starts with the Acme Shop example design system until their team's is added.
   - Tell them to open the new folder in Claude Code (File → Open Folder, or a new session in that folder), where they can describe their first screen.
   - Opening the folder also turns on Cogitato's tools there.

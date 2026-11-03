---
name: setup-machine
description: Get this computer ready to run a Cogitato prototype - install what's missing, install the prototype's parts, start it, and check everything works. Use when the Cogitato session check reports setup problems, or when the designer says the prototype won't run or asks to set up.
argument-hint: ""
---

# Set up this computer

The person is usually a designer who doesn't use a terminal. You run every command yourself.
- Before each step, say in one plain line what you're doing and why ("Installing Node, which the prototype runs on").
- Ask before installing software on their computer.
- If a step fails, explain the problem in plain words and suggest the fix. Don't paste raw error output unless they ask.

Work in the prototype folder: the one that contains `design/contract`.

1. **Node.js 22 or newer.**
   - Check it with `node --version`.
   - If it's missing or too old, ask, then install the current LTS:
     - On Windows: `winget install OpenJS.NodeJS.LTS`.
     - On macOS: `brew install node` if Homebrew is there; otherwise point them to the installer at nodejs.org.
   - New installs may need a fresh terminal. Check the version again.
2. **pnpm.**
   - Check it with `pnpm --version`.
   - If it's missing, run `corepack enable pnpm`. If corepack isn't available, use `npm install -g pnpm`.
3. **The prototype's parts.** Run `pnpm install` in the prototype folder.
4. **Settings.** If `.env.example` exists and `.env` doesn't, copy it to `.env`. If a value is blank and the prototype needs it, tell the designer to ask a developer for it. Never invent secrets.
5. **Saving versions.** If `git config user.name` or `git config user.email` is empty, ask the designer which name and email to put on their work, and set both.
6. **Check.** Run `pnpm kit doctor`. Fix anything marked PROBLEM by going back to the step it relates to.
7. **Start it.**
   - Start `pnpm dev` in the background.
   - Once it's up, give them the address: http://localhost:5173, plus `/__kit` for the design kit.
   - Tell them that from now on they can just describe screens and states.
8. Cogitato's tools load when a session starts. If they still aren't available after setup, ask the designer to start a new session.

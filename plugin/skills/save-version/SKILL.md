---
name: save-version
description: Save the designer's prototype work as a version and share it, without them touching git. Use only when the designer asks to save, share or keep their work.
argument-hint: "[what this version is, optional]"
disable-model-invocation: true
allowed-tools: mcp__plugin_cogitato_kit__validate mcp__plugin_cogitato_kit__save_version
---

# Save a version

The person is usually a designer. Don't mention git, commits, branches or pushing unless they ask.

Note from the designer: $ARGUMENTS

1. Run `validate`.
   - If it finds problems, tell the designer in one plain sentence what's wrong.
   - Ask once whether to fix them first or save anyway. Fixing first is better.
   - If they choose to fix, fix the problems, then continue.
2. Call `save_version`. Pass the designer's note as `message` if they gave one; otherwise leave it out and a description is generated from the changes.
3. Reply in one or two sentences, using the tool's message: whether it was saved, whether it was shared, and the preview link if the message has one. Others can open the preview to see the whole flow.
4. If saving fails because their name and email aren't set up, ask for the name and email they want on their work. Set them with `git config user.name` and `git config user.email` in this folder, then save again.

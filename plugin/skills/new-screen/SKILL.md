---
name: new-screen
description: Create a new screen in a Cogitato prototype from a plain-language description, built only from the team's design kit, checked, and linked. Use when the designer asks for a new screen, page or step.
when_to_use: 'For example "add a review screen before payment", "I need a new order history page", "make a screen where people pick a delivery slot".'
argument-hint: "[what the screen is for]"
allowed-tools: mcp__plugin_cogitato_kit__list_components mcp__plugin_cogitato_kit__get_component mcp__plugin_cogitato_kit__get_tokens mcp__plugin_cogitato_kit__create_screen mcp__plugin_cogitato_kit__add_state mcp__plugin_cogitato_kit__log_gap mcp__plugin_cogitato_kit__validate mcp__plugin_cogitato_kit__canvas_link
---

# New screen

The person is usually a designer, not a developer. Talk in plain language about screens, states and steps, never about files, ids or code, and never ask them to run anything.

Request: $ARGUMENTS

1. **Understand it.** Work out what the screen is for and which step leads to it. Ask one short question only if you can't tell. Otherwise state your plan in a sentence ("I'll add a Review screen after Payment, reached by a Review order button") and go ahead.
2. **Create it** with `create_screen`:
   - `id`: lowercase words with dots, grouped with its neighbours (`checkout.review` next to `checkout.payment`).
   - `title`: the name people see.
   - `from` and `label`: the existing state that leads here and the action that gets there.
3. **Build the UI** in the new screen file:
   - Look up what you need with `list_components`, `get_component` and `get_tokens`. Don't read the contract files directly.
   - Use only kit components (`@/kit/...`) and token variables (`var(--kit-...)`). Follow the component rules.
   - Give every button, link, input and kit component with an `on...` prop a `data-kit-id` of `"{screen id}.{name}"`, like `checkout.review.place-order`.
   - Put content in the state's `data` and read it with `useFixture()`. Move between states with `useGoToState()`.
   - If the screen needs other states (empty, error, loading), add them with `add_state`, then show each one in the UI.
4. **If the kit doesn't have something**, don't build or hardcode it. Use the closest kit component or token, tell the designer what you used, and record the gap with `log_gap`.
5. **Finish:**
   - Run `validate` and fix every problem. The edit checks will also report problems as you go.
   - Reply in two or three sentences: what you made, any gaps you logged, and the canvas link from `canvas_link`, where they can see the new screen among the rest of the flow.

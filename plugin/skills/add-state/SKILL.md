---
name: add-state
description: Add a state to an existing screen of a Cogitato prototype (an error, empty, loading or other variation), connect it in the flow, check it and link it. Use when the designer asks for a variation of a screen.
when_to_use: 'For example "show what happens when the card is expired", "add an empty state to the cart", "what does payment look like while it is processing".'
argument-hint: "[screen and what the state shows]"
allowed-tools: mcp__plugin_cogitato_kit__list_components mcp__plugin_cogitato_kit__get_component mcp__plugin_cogitato_kit__get_tokens mcp__plugin_cogitato_kit__add_state mcp__plugin_cogitato_kit__log_gap mcp__plugin_cogitato_kit__validate mcp__plugin_cogitato_kit__canvas_link
---

# Add a state

The person is usually a designer, not a developer. Talk in plain language, never about files, ids or code, and never ask them to run anything.

Request: $ARGUMENTS

1. **Pick the screen and the state.**
   - Find the screen they mean. Each screen registers itself in its `screen.tsx` with `defineScreen`.
   - Choose a state name of lowercase words joined by dashes (`card-expired`) and a short title ("Card expired").
   - Decide which existing state leads to it, and by what action. For example, `checkout.payment.processing` leads to it, labelled "Card expired".
   - Ask only if the screen is genuinely unclear.
2. **Add it** with `add_state` (`screen`, `state`, `title`, `from`, `label`).
3. **Make the screen show it:**
   - Fill in the new state's `data` in the screen's `fixtures`.
   - Change the screen's UI so it renders correctly with that data.
   - Use kit components and token variables only, looking them up with `get_component` and `get_tokens`.
   - New interactive elements need `data-kit-id="{screen id}.{name}"`.
   - If the action that leads here happens in the UI, wire it with `useGoToState()("{screen id}.{state}")`.
4. **Missing from the kit?** Use the closest component or token, say so, and record it with `log_gap`.
5. **Finish:** run `validate` and fix every problem. Then reply in one or two sentences with what the state shows and its canvas link from `canvas_link`.

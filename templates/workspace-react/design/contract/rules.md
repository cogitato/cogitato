# Acme Shop design rules

These apply to every prototype screen. The validator enforces the ones marked **(checked)**.

## Do
- Use tokens for every color, size, space, radius and shadow. **(checked)**
- Build with kit components from `@/kit/...`. **(checked)**
- Give every interactive element a `data-kit-id`. **(checked)**
- Lay out with `Stack` and its `gap`, not custom margins.
- Keep one primary `Button` per view.
- Write button labels as verbs ("Pay now").

## Don't
- Hardcode values like `#2563eb` or `16px`. **(checked)**
- Nest a `Card` inside another `Card`.
- Use `danger` styles for anything that isn't destructive or an error.

## Missing something?
If the kit doesn't have what you need, log a gap instead of improvising. Developers review gaps before the next contract update.

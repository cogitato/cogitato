# 03 · Prototype Template + Fixture System

**Location:** `templates/prototype-react`  ·  **Phase:** 1

## Responsibility
The app designers actually build in. Cloned into each prototype repo by intake.

## Contents
- App shell, router, and a `src/kit/` folder of contract components (real imports, wrappers, or generated)
- Token CSS generated from `tokens.json`
- **Fixture system:** each screen registers named fixtures (mock data + initial UI state). `?fixture=name` loads one.
- **Frame mode:** `?kit-frame=1` hides dev chrome and enables the annotation bridge (postMessage to the canvas: element rects for `data-kit-id`, hover/click selection)
- Mock data layer (no real backend)
- Plugin settings committed so the Cogitato plugin auto-enables when the repo is opened in Claude Code
- `CLAUDE.md` pointing at the contract and rules

## Fixture registration (sketch)
```ts
defineScreen({
  id: "checkout.payment",
  route: "/checkout/payment",
  fixtures: {
    default: { cart: sampleCart },
    "card-declined": { cart: sampleCart, paymentError: "declined" },
  },
});
```
`kit export-flows` reads these registrations.

## Key decisions
- v1 stack: React + TypeScript + Vite. Simple, fast, and the most common target.
- Other production stacks are handled by the contract's `mapping`, not by matching the stack (per the concept doc's tradeoff).

## Open questions
- Do we need a Next.js variant early for teams whose production app is Next?
- How are flow edges declared: in code next to screens, or in a separate `flows.ts`?

## Done when
- A designer prompt like "add the card-declined state" results in a registered fixture that appears in `flows.json` and loads at its URL.

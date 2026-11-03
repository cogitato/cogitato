# @cogitato/runtime

What every Cogitato prototype runs on ([03-prototype-template.md](../../docs/architecture/components/03-prototype-template.md), [ADR 005](../../docs/decisions/005-prototype-stack.md)).

```ts
// src/screens/checkout/payment/screen.tsx
export default defineScreen({
  id: "checkout.payment",
  route: "/checkout/payment",
  title: "Payment",
  fixtures: {
    default: { title: "Empty form", data: {} },
    "card-declined": { data: { declined: true } }, // title defaults to "Card declined"
  },
  component: PaymentScreen,
});
```

- **Hooks:**
  - `useFixture()`: the current state's data.
  - `useGoToState()("checkout.payment.card-declined")`: follow a flow edge.
  - `useFrameMode()`: skip timers when shown on the canvas.
  - `useScreen()`.
- **URLs:** `{route}?fixture={state}` opens a state, and `&kit-frame=1` hides the dev chrome and starts the frame bridge (`kit:rects`, `kit:hover` and `kit:select` messages to the parent window). `/` lists every screen and state. `/__kit` shows the design kit with live, manifest-generated demos (override with `src/kit/<Name>.demo.tsx`). `/__canvas` shows the canvas ([`@cogitato/canvas`](../canvas)), loaded lazily. Frame mode also posts `kit:state` so the canvas knows which state a frame shows.
- **Vite plugin** (`@cogitato/runtime/vite`): the `@` → `src` alias, `virtual:kit/tokens.css`, and `virtual:kit/kit`. For the canvas it serves `/__kit-data/flows.json` and `/__kit-data/status` (dev only; status changes go through the prototype's kit-cli), and copies `flows.json` into the build. Add `"@cogitato/runtime/client"` to `compilerOptions.types` for their types.

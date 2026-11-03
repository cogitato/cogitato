# Checkout v1

Commit `a1b2c3d` · Generated 2026-11-01. Machine-readable version: [spec.json](spec.json).

## 1. Intent
Let shoppers pay in one pass and recover from a declined card without losing their cart.

## 2. Flow map and states
**Checkout:** Cart → Shipping → Payment → Processing → Confirmed, with branches to *Address not found* and *Card declined*.

| State | Canvas |
|---|---|
| Cart · Two items | `checkout#cart.default` |
| Shipping · Empty form | `checkout#checkout.shipping.default` |
| Shipping · Address not found | `checkout#checkout.shipping.invalid-address` |
| Payment · Empty form | `checkout#checkout.payment.default` |
| Payment · Processing | `checkout#checkout.payment.processing` |
| Payment · Card declined | `checkout#checkout.payment.card-declined` |
| Order confirmed | `checkout#checkout.confirmation.default` |

## 3. Components
- **Reused:** Button, Input, Text, Stack
- **Modified:** Banner (adds an action link inside danger banners)
- **New:** Stepper (checkout progress indicator, from gap `gap_stepper`)

## 4. Data and behavior
- Payment: submitting shows Processing, then Confirmed or Card declined (chosen by fixture).
- Shipping: address lookup is mocked; `invalid-address` simulates a failed lookup.

## 5. Resolved annotations
- *Intent* on `checkout.payment.error-banner`: error copy should say what to do next.
- *Question* on `checkout.payment.submit`: keep Pay now enabled? **Yes, show inline errors on submit.**

## 6. Open questions
- Retry the payment automatically once before showing Card declined? (owner: dev_alex)

## 7. Acceptance criteria
- A declined card returns the shopper to the payment form with cart and shipping intact.
- The declined-card banner tells the shopper what to try next.
- Pay now stays enabled; invalid fields show inline errors on submit.

## 8. Trust boundary
Layout and component composition are trustworthy; data handling and logic are not.

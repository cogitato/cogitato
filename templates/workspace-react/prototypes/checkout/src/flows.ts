import { defineFlows } from "@cogitato/runtime";

// How screens connect. Each step is "{screen id}.{state}". `kit export-flows` turns this into
// design/flows.json for the canvas; steps appear in the order they're first mentioned.
export default defineFlows([
  {
    id: "checkout",
    title: "Checkout",
    edges: [
      { from: "cart.default", to: "checkout.shipping.default", label: "Check out" },
      { from: "checkout.shipping.default", to: "checkout.shipping.invalid-address", label: "Continue, address not found" },
      { from: "checkout.shipping.default", to: "checkout.payment.default", label: "Continue" },
      { from: "checkout.payment.default", to: "checkout.payment.processing", label: "Pay now" },
      { from: "checkout.payment.processing", to: "checkout.payment.card-declined", label: "Declined" },
      { from: "checkout.payment.processing", to: "checkout.confirmation.default", label: "Approved" },
    ],
  },
]);

import { useEffect } from "react";
import { defineScreen, useFixture, useFrameMode, useGoToState } from "@cogitato/runtime";
import { Page } from "@/components/Page";
import { Banner } from "@/kit/Banner";
import { Button } from "@/kit/Button";
import { Card } from "@/kit/Card";
import { Input } from "@/kit/Input";
import { Stack } from "@/kit/Stack";
import { Text } from "@/kit/Text";
import { money, sampleCart, subtotal } from "@/mocks/cart";

interface PaymentData {
  processing?: boolean;
  declined?: boolean;
}

const total = subtotal(sampleCart) + sampleCart.shipping;

function PaymentScreen() {
  const { processing = false, declined = false } = useFixture<PaymentData>();
  const goTo = useGoToState();
  const frame = useFrameMode();

  // The mock payment always succeeds after a moment. Canvas frames hold still.
  useEffect(() => {
    if (!processing || frame) return;
    const timer = setTimeout(() => goTo("checkout.confirmation.default"), 1500);
    return () => clearTimeout(timer);
  }, [processing, frame, goTo]);

  return (
    <Page title="Payment" step="Payment">
      {declined && (
        <Banner tone="danger" title="Your card was declined" data-kit-id="checkout.payment.error-banner">
          Try another card, or check the details with your bank.
        </Banner>
      )}
      <Card>
        <Stack gap="4">
          <Input label="Card number" placeholder="1234 5678 9012 3456" disabled={processing} data-kit-id="checkout.payment.card-number" />
          <Stack direction="row" gap="3">
            <Input label="Expiry" placeholder="MM / YY" disabled={processing} data-kit-id="checkout.payment.expiry" />
            <Input label="Security code" placeholder="123" disabled={processing} data-kit-id="checkout.payment.cvc" />
          </Stack>
          <Input label="Name on card" disabled={processing} data-kit-id="checkout.payment.cardholder" />
        </Stack>
      </Card>
      <Stack direction="row" gap="4">
        <Text variant="label" style={{ flex: 1 }}>
          Total
        </Text>
        <Text variant="label">{money(total)}</Text>
      </Stack>
      <Button
        fullWidth
        size="lg"
        loading={processing}
        data-kit-id="checkout.payment.submit"
        onPress={() => goTo("checkout.payment.processing")}
      >
        {processing ? "Processing" : `Pay ${money(total)}`}
      </Button>
    </Page>
  );
}

export default defineScreen<PaymentData>({
  id: "checkout.payment",
  route: "/checkout/payment",
  title: "Payment",
  fixtures: {
    default: { title: "Empty form", data: {} },
    processing: { title: "Processing", data: { processing: true } },
    "card-declined": { title: "Card declined", data: { declined: true } },
  },
  component: PaymentScreen,
});

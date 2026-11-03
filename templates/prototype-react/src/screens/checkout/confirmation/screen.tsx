import { defineScreen, useFixture, useGoToState } from "@cogitato/runtime";
import { Page } from "@/components/Page";
import { Button } from "@/kit/Button";
import { Card } from "@/kit/Card";
import { Stack } from "@/kit/Stack";
import { Text } from "@/kit/Text";

function ConfirmationScreen() {
  const { orderNumber, email } = useFixture<{ orderNumber: string; email: string }>();
  const goTo = useGoToState();
  return (
    <Page title="Order confirmed">
      <Card padding="lg" elevation="raised">
        <Stack gap="2">
          <Text variant="label">Order {orderNumber}</Text>
          <Text tone="muted">We've sent a receipt to {email}. Your order ships in 1–2 business days.</Text>
        </Stack>
      </Card>
      <Button variant="secondary" data-kit-id="checkout.confirmation.done" onPress={() => goTo("cart.empty")}>
        Back to the shop
      </Button>
    </Page>
  );
}

export default defineScreen({
  id: "checkout.confirmation",
  route: "/checkout/confirmation",
  title: "Order confirmed",
  fixtures: {
    default: { title: "Confirmed", data: { orderNumber: "#10482", email: "sam@example.com" } },
  },
  component: ConfirmationScreen,
});

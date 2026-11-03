import { defineScreen, useFixture, useGoToState } from "@cogitato/runtime";
import { Page } from "@/components/Page";
import { Button } from "@/kit/Button";
import { Card } from "@/kit/Card";
import { Stack } from "@/kit/Stack";
import { Text } from "@/kit/Text";
import { emptyCart, money, sampleCart, subtotal, type Cart } from "@/mocks/cart";

function CartScreen() {
  const { cart } = useFixture<{ cart: Cart }>();
  const goTo = useGoToState();

  if (cart.items.length === 0) {
    return (
      <Page title="Your cart" step="Cart">
        <Card padding="lg">
          <Stack gap="3" align="start">
            <Text>Your cart is empty.</Text>
            <Button variant="secondary" data-kit-id="cart.keep-shopping">
              Keep shopping
            </Button>
          </Stack>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Your cart" step="Cart">
      <Card>
        <Stack gap="4">
          {cart.items.map((item) => (
            <Stack key={item.id} direction="row" gap="4">
              <Stack gap="1" style={{ flex: 1 }}>
                <Text variant="label">{item.name}</Text>
                <Text tone="muted">
                  {item.variant} · Qty {item.quantity}
                </Text>
              </Stack>
              <Text>{money(item.price * item.quantity)}</Text>
            </Stack>
          ))}
        </Stack>
      </Card>
      <Stack direction="row" gap="4">
        <Text variant="label" style={{ flex: 1 }}>
          Subtotal
        </Text>
        <Text variant="label">{money(subtotal(cart))}</Text>
      </Stack>
      <Button fullWidth size="lg" data-kit-id="cart.checkout" onPress={() => goTo("checkout.shipping.default")}>
        Check out
      </Button>
    </Page>
  );
}

export default defineScreen({
  id: "cart",
  route: "/cart",
  title: "Cart",
  fixtures: {
    default: { title: "Two items", data: { cart: sampleCart } },
    empty: { title: "Empty cart", data: { cart: emptyCart } },
  },
  component: CartScreen,
});

import { defineScreen, useFixture, useGoToState } from "@cogitato/runtime";
import { Page } from "@/components/Page";
import { Banner } from "@/kit/Banner";
import { Button } from "@/kit/Button";
import { Input } from "@/kit/Input";
import { Stack } from "@/kit/Stack";
import { sampleAddress, type Address } from "@/mocks/cart";

interface ShippingData {
  address: Partial<Address>;
  addressError?: string;
}

function ShippingScreen() {
  const { address, addressError } = useFixture<ShippingData>();
  const goTo = useGoToState();

  return (
    <Page title="Where should we send it?" step="Shipping">
      {addressError && (
        <Banner tone="danger" title="We couldn't find that address" data-kit-id="checkout.shipping.address-banner">
          Check the street and postcode, then try again.
        </Banner>
      )}
      <Stack gap="4">
        <Input label="Full name" value={address.name} data-kit-id="checkout.shipping.name" />
        <Input label="Street address" value={address.street} error={addressError} data-kit-id="checkout.shipping.street" />
        <Stack direction="row" gap="3">
          <Input label="City" value={address.city} data-kit-id="checkout.shipping.city" style={{ flex: 1 }} />
          <Input label="Postcode" value={address.postcode} data-kit-id="checkout.shipping.postcode" />
        </Stack>
      </Stack>
      <Stack gap="2">
        <Button fullWidth size="lg" data-kit-id="checkout.shipping.continue" onPress={() => goTo("checkout.payment.default")}>
          Continue to payment
        </Button>
        <Button variant="ghost" data-kit-id="checkout.shipping.back" onPress={() => goTo("cart.default")}>
          Back to cart
        </Button>
      </Stack>
    </Page>
  );
}

export default defineScreen<ShippingData>({
  id: "checkout.shipping",
  route: "/checkout/shipping",
  title: "Shipping",
  fixtures: {
    default: { title: "Empty form", data: { address: {} } },
    "invalid-address": {
      title: "Address not found",
      data: {
        address: { ...sampleAddress, street: "12 Harbor Ln" },
        addressError: "We couldn't match this street to the postcode.",
      },
    },
  },
  component: ShippingScreen,
});

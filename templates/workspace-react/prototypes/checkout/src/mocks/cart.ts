// Mock data for the checkout flow. Prototypes have no backend; fixtures pick from these.

export interface CartItem {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: number;
}

export interface Cart {
  items: CartItem[];
  shipping: number;
}

export const sampleCart: Cart = {
  items: [
    { id: "tote", name: "Canvas tote", variant: "Natural", quantity: 1, price: 24 },
    { id: "mug", name: "Ceramic mug", variant: "Speckled white", quantity: 2, price: 18 },
  ],
  shipping: 5,
};

export const emptyCart: Cart = { items: [], shipping: 0 };

export const subtotal = (cart: Cart) => cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export interface Address {
  name: string;
  street: string;
  city: string;
  postcode: string;
}

export const sampleAddress: Address = {
  name: "Sam Rivera",
  street: "12 Harbour Lane",
  city: "Portland",
  postcode: "97201",
};

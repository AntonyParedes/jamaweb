import { useSyncExternalStore } from "react";
import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(100),
  qty: z.number().int().min(1).max(100),
});
export type CartItem = z.infer<typeof cartItemSchema>;
const KEY = "jama-cart-v1";
const empty: CartItem[] = [];
let cart: CartItem[] = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const result = z
      .array(cartItemSchema)
      .max(50)
      .safeParse(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    if (result.success)
      cart = result.data.filter(
        (item, i, items) => items.findIndex((x) => x.productId === item.productId) === i,
      );
  } catch {
    /* Ignore corrupt or unavailable local storage. */
  }
}
function save(next: CartItem[]) {
  cart = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    /* In-memory cart still works. */
  }
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
  };
}
export function useCart() {
  return useSyncExternalStore(
    subscribe,
    () => cart,
    () => empty,
  );
}
export function addToCart(productId: string, qty: number) {
  const parsed = cartItemSchema.parse({ productId, qty });
  load();
  const existing = cart.find((item) => item.productId === productId);
  if (!existing && cart.length >= 50) throw new Error("El carrito está lleno.");
  save(
    existing
      ? cart.map((item) =>
          item.productId === productId
            ? { ...item, qty: Math.min(100, item.qty + parsed.qty) }
            : item,
        )
      : [...cart, parsed],
  );
}
export function setCartQuantity(productId: string, qty: number) {
  load();
  if (qty === 0) {
    save(cart.filter((item) => item.productId !== productId));
    return;
  }
  const parsed = cartItemSchema.parse({ productId, qty });
  save(cart.map((item) => (item.productId === productId ? parsed : item)));
}

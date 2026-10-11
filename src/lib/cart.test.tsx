import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
describe("Guest cart", () => {
  it("persists quantities across a reload without requiring authentication", async () => {
    const first = await import("./cart");
    first.addToCart("torta-chocolate", 2);
    first.addToCart("torta-chocolate", 1);
    expect(JSON.parse(localStorage.getItem("jama-cart-v1")!)).toEqual([
      { productId: "torta-chocolate", qty: 3 },
    ]);
    vi.resetModules();
    const reloaded = await import("./cart");
    const { result } = renderHook(() => reloaded.useCart());
    expect(result.current).toEqual([{ productId: "torta-chocolate", qty: 3 }]);
    act(() => reloaded.setCartQuantity("torta-chocolate", 0));
    expect(result.current).toEqual([]);
  });
  it("rejects invalid quantities and safely ignores corrupt storage", async () => {
    localStorage.setItem("jama-cart-v1", '[{"productId":"x","qty":-1}]');
    const cart = await import("./cart");
    const { result } = renderHook(() => cart.useCart());
    expect(result.current).toEqual([]);
    expect(() => cart.addToCart("x", -1)).toThrow();
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutInputSchema, getVerifiedQuote } from "./checkout-service";

const getUser = vi.fn();
const rpc = vi.fn();
const client = { auth: { getUser }, rpc } as unknown as SupabaseClient;
const items = [{ productId: "torta-chocolate", qty: 2 }];
const quote = () => ({
  items: [{ ...items[0], name: "Chocolate", unitPriceCents: 1700, subtotalCents: 3400 }],
  totalCents: 3400,
  currency: "PEN",
  expiresAt: new Date(Date.now() + 300000).toISOString(),
});
beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
});
describe("Authoritative checkout validation", () => {
  it("rejects unverified tokens before querying prices", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    expect(await getVerifiedQuote(client, items)).toMatchObject({ ok: false, reason: "session" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses the database quote instead of local catalog prices", async () => {
    rpc.mockResolvedValue({ data: quote(), error: null });
    expect(await getVerifiedQuote(client, items)).toMatchObject({
      ok: true,
      quote: { totalCents: 3400 },
    });
    expect(rpc).toHaveBeenCalledWith("jama_checkout_quote", { requested_items: items });
  });
  it("rejects unavailable stock and does not create orders", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Product unavailable" } });
    expect(await getVerifiedQuote(client, items)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("rejects expired, partial and inconsistent quotes", async () => {
    for (const patch of [
      { expiresAt: new Date(0).toISOString() },
      { totalCents: 1 },
      { items: [] },
      { items: [{ ...quote().items[0], qty: 1 }] },
      { items: [{ ...quote().items[0], productId: "private" }] },
    ]) {
      rpc.mockResolvedValue({ data: { ...quote(), ...patch }, error: null });
      expect(await getVerifiedQuote(client, items)).toMatchObject({
        ok: false,
        reason: "unavailable",
      });
    }
  });
  it("rejects client prices, duplicate IDs and invalid quantities", () => {
    for (const entries of [
      [{ ...items[0], price: 1 }],
      [items[0], items[0]],
      [{ productId: "x", qty: 0 }],
      [{ productId: "x", qty: 1.5 }],
      [{ productId: "x", qty: 101 }],
      [],
    ])
      expect(checkoutInputSchema.safeParse({ accessToken: "token", items: entries }).success).toBe(
        false,
      );
    expect(checkoutInputSchema.safeParse({ accessToken: "", items }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { availableProducts, discountLabel, discountPercent, type Product } from "./products";

describe("discountPercent", () => {
  it("S/ 25 → S/ 15 is 40% off", () => {
    expect(discountPercent(15, 25)).toBe(40);
  });
  it("no discount when price is not lower", () => {
    expect(discountPercent(25, 25)).toBe(0);
  });
  it("calculates the requested example and recalculates when prices change", () => {
    expect(discountPercent(12, 20)).toBe(40);
    expect(discountPercent(10, 20)).toBe(50);
    expect(discountPercent(10, 25)).toBe(60);
    expect(discountPercent(10, NaN)).toBe(0);
    expect(discountPercent(-1, 20)).toBe(0);
  });
  it("keeps fractional discounts exact for sorting, without inflating the badge", () => {
    expect(discountPercent(2, 3)).toBeCloseTo(100 / 3);
    expect(discountLabel(2, 3)).toBe("33");
    expect(discountLabel(12, 20)).toBe("40");
    expect(discountLabel(1, 3)).toBe("66");
    expect(discountLabel(10, 18)).toBe("44");
  });
});

describe("Available catalog ordering", () => {
  const now = Date.parse("2026-10-11T18:00:00Z");
  const product = (id: string, patch: Partial<Product> = {}): Product => ({
    id,
    name: "Oferta real",
    category: "restaurantes",
    store: "Negocio",
    zone: "Centro",
    image: "/foto.png",
    description: "Un plato",
    price: 12,
    originalPrice: 20,
    stock: 2,
    startsAt: "2026-10-11T17:00:00Z",
    endsAt: "2026-10-11T20:00:00Z",
    ...patch,
  });
  it("sorts by exact percentage, then earliest closing time, without mutating input", () => {
    const input = [
      product("low", { price: 15 }),
      product("later"),
      product("sooner", { endsAt: "2026-10-11T19:00:00Z" }),
      product("highest", { price: 5 }),
    ];
    expect(availableProducts(input, now).map((p) => p.id)).toEqual([
      "highest",
      "sooner",
      "later",
      "low",
    ]);
    expect(input[0]?.id).toBe("low");
  });
  it("does not treat close fractional percentages as a tie", () => {
    expect(
      availableProducts(
        [
          product("less", { price: 200.02, originalPrice: 300, endsAt: "2026-10-11T18:01:00Z" }),
          product("more", { price: 200.01, originalPrice: 300 }),
        ],
        now,
      ).map((p) => p.id),
    ).toEqual(["more", "less"]);
  });
  it("excludes invalid money, stock, dates, scheduled and expired offers", () => {
    const patches = [
      { stock: 0 },
      { stock: -1 },
      { stock: 1.5 },
      { price: 20 },
      { price: Infinity },
      { originalPrice: NaN },
      { price: 0 },
      { startsAt: "2026-10-11T19:00:00Z" },
      { endsAt: "2026-10-11T18:00:00Z" },
      { endsAt: "invalid" },
      { startsAt: "2026-10-12T00:00:00Z" },
    ];
    expect(
      availableProducts(
        patches.map((p, i) => product(String(i), p)),
        now,
      ),
    ).toEqual([]);
    expect(availableProducts([], now)).toEqual([]);
  });
});

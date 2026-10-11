import { describe, expect, it } from "vitest";
import {
  businessSchema,
  normalizeWhatsapp,
  offerSchema,
  parsePrice,
  fromLimaInput,
  limaInput,
  imageExtension,
  validateImageBytes,
  MAX_IMAGE_BYTES,
  offerStatus,
  whatsappLink,
} from "./offers";
import { safeNext } from "./auth";

const offer = {
  id: "00000000-0000-4000-8000-000000000021",
  name: "Torta de chocolate",
  description: "Porción fresca de chocolate",
  category: "tortas",
  originalPriceCents: 2500,
  priceCents: 1500,
  stock: 4,
  startsAt: new Date(Date.now() - 10000).toISOString(),
  endsAt: new Date(Date.now() + 3600000).toISOString(),
};
describe("Seller offer validation", () => {
  it("accepts extensible category identifiers but rejects approval and owner injection", () => {
    const business = {
      name: "Cafetería",
      zone: "Centro",
      whatsapp: "+51 912345678",
      category: "cafeteria",
    };
    expect(businessSchema.safeParse(business).success).toBe(true);
    expect(businessSchema.safeParse({ ...business, status: "approved" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, category: "" }).success).toBe(false);
    expect(offerSchema.safeParse({ ...offer, category: "nueva_categoria" }).success).toBe(true);
    // Actual membership/compatibility is checked against Supabase by the backend and SQL.
  });
  it("requires a valid commercial WhatsApp and normalizes country prefixes", () => {
    expect(normalizeWhatsapp("+51 912-345-678")).toBe("51912345678");
    expect(normalizeWhatsapp("912345678")).toBe("51912345678");
    expect(normalizeWhatsapp("0034 612 345 678")).toBe("34612345678");
    for (const whatsapp of ["", "+51", "abc912345678", "+51 123456789", "+00 12345"])
      expect(
        businessSchema.safeParse({ name: "Negocio", zone: "Centro", whatsapp, category: "otros" })
          .success,
      ).toBe(false);
    expect(
      businessSchema.safeParse({
        name: "Negocio",
        zone: "Centro",
        whatsapp: "+51 912345678",
        category: "otros",
        owner_id: "another-user",
      }).success,
    ).toBe(false);
  });
  it("stores money exactly as integer cents and rejects invalid discounts", () => {
    expect(parsePrice("12,99")).toBe(1299);
    expect(parsePrice("0.01")).toBe(1);
    for (const value of ["0", "-1", "NaN", "1.999", "1e3", "1000001", ""])
      expect(() => parsePrice(value)).toThrow();
    for (const patch of [
      { priceCents: 2500 },
      { priceCents: 0 },
      { stock: 0 },
      { stock: 1.5 },
      { category: "../invalid" },
      { business_id: "forged" },
      { endsAt: new Date(Date.now() - 20000).toISOString() },
    ])
      expect(offerSchema.safeParse({ ...offer, ...patch }).success).toBe(false);
    expect(offerSchema.safeParse(offer).success).toBe(true);
  });
  it("converts dates using Lima rather than the machine timezone", () => {
    expect(fromLimaInput("2026-10-11T18:30")).toBe("2026-10-11T23:30:00.000Z");
    expect(limaInput("2026-10-11T23:30:00Z")).toBe("2026-10-11T18:30");
    expect(() => fromLimaInput("2026-02-30T18:30")).toThrow();
  });
  it("validates image size, MIME and actual signatures", () => {
    expect(imageExtension({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBe("jpg");
    for (const file of [
      { type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 },
      { type: "image/svg+xml", size: 100 },
      { type: "image/png", size: 0 },
    ])
      expect(() => imageExtension(file)).toThrow();
    expect(() =>
      validateImageBytes(new TextEncoder().encode("<svg onload='alert(1)'/>"), "image/jpeg"),
    ).toThrow();
    expect(() =>
      validateImageBytes(new Uint8Array([255, 216, 255, 10]), "image/jpeg"),
    ).not.toThrow();
    expect(() =>
      validateImageBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    ).not.toThrow();
    expect(() =>
      validateImageBytes(new TextEncoder().encode("RIFF1234WEBPbytes"), "image/webp"),
    ).not.toThrow();
  });
  it("calculates offer states from the provided server clock", () => {
    const now = Date.now();
    const input = { ...offer, published: true };
    expect(offerStatus(input, now)).toBe("Activa");
    expect(offerStatus({ ...input, published: false }, now)).toBe("Pausada");
    expect(offerStatus({ ...input, stock: 0 }, now)).toBe("Agotada");
    expect(offerStatus({ ...input, startsAt: new Date(now + 1000).toISOString() }, now)).toBe(
      "Programada",
    );
    expect(offerStatus(input, now + 7200000)).toBe("Vencida");
  });
  it("encodes a subtle WhatsApp message and allows only controlled login returns", () => {
    const url = new URL(whatsappLink("+51 912345678", "Torta & café", 1599));
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/51912345678");
    expect(url.searchParams.get("text")).toBe(
      "Hola, vengo de JAMA y quisiera aprovechar el descuento de Torta & café a S/ 15.99. ¿Sigue disponible?",
    );
    expect(safeNext(`/oferta/${offer.id}`)).toBe(`/oferta/${offer.id}`);
    expect(safeNext("/vender")).toBe("/vender");
    for (const path of [
      `/oferta/${offer.id}?next=https://evil.example`,
      `/oferta/${offer.id}/../`,
      "//evil.example",
      "/oferta/%2F%2Fevil.example",
    ])
      expect(safeNext(path)).toBe("/cuenta");
  });
});

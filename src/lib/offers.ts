import { z } from "zod";

export const IMAGE_BUCKET = "offer-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const offerIdSchema = z.string().uuid();
export const tokenSchema = z.string().min(1).max(16384);
export const categoryIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{1,49}$/, "Selecciona una categoría válida.");

export function normalizeWhatsapp(value: string): string {
  const clean = value.trim().replace(/[\s()-]/g, "");
  if (!/^(\+|00)?\d+$/.test(clean)) throw new Error("Escribe un WhatsApp con código de país.");
  let phone = clean.replace(/^\+|^00/, "");
  if (/^9\d{8}$/.test(phone)) phone = `51${phone}`;
  if (!/^[1-9]\d{7,14}$/.test(phone) || (phone.startsWith("51") && !/^519\d{8}$/.test(phone)))
    throw new Error("Revisa el WhatsApp. En Perú usa +51 y un celular de 9 dígitos.");
  return phone;
}

export const businessSchema = z
  .object({
    category: categoryIdSchema,
    name: z.string().trim().min(3, "Escribe el nombre del negocio.").max(120),
    zone: z.string().trim().min(3, "Escribe la dirección o zona del negocio.").max(200),
    whatsapp: z.string().transform((value, ctx) => {
      try {
        return normalizeWhatsapp(value);
      } catch (error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
        return z.NEVER;
      }
    }),
  })
  .strict();

export const offerSchema = z
  .object({
    id: offerIdSchema,
    name: z.string().trim().min(3, "Escribe el nombre del producto.").max(120),
    description: z.string().trim().min(3, "Describe el producto.").max(2000),
    category: categoryIdSchema,
    originalPriceCents: z.number().int().positive().max(100000000),
    priceCents: z.number().int().positive().max(100000000),
    stock: z.number().int().min(1, "La cantidad debe ser un entero positivo.").max(100000),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.priceCents >= data.originalPriceCents)
      ctx.addIssue({
        code: "custom",
        path: ["priceCents"],
        message: "El descuento debe ser menor que el precio normal.",
      });
    if (
      Date.parse(data.endsAt) <= Date.parse(data.startsAt) ||
      Date.parse(data.endsAt) <= Date.now()
    )
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "El fin del descuento debe ser posterior al inicio y al momento actual.",
      });
  });
export type OfferInput = z.infer<typeof offerSchema>;
export type Business = {
  id: string;
  name: string;
  zone: string;
  whatsapp: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  review_note: string;
};
export type SellerOffer = OfferInput & { imagePath: string; published: boolean };
export type OfferStatus = "Programada" | "Activa" | "Pausada" | "Vencida" | "Agotada";
export function offerStatus(
  offer: Pick<SellerOffer, "published" | "stock" | "startsAt" | "endsAt">,
  serverNow: number,
): OfferStatus {
  if (Date.parse(offer.endsAt) <= serverNow) return "Vencida";
  if (offer.stock <= 0) return "Agotada";
  if (!offer.published) return "Pausada";
  return Date.parse(offer.startsAt) > serverNow ? "Programada" : "Activa";
}

export function parsePrice(value: string): number {
  const clean = value.trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean))
    throw new Error("Escribe un precio con hasta dos decimales.");
  const [whole = "0", fraction = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0 || cents > 100000000) throw new Error("Escribe un precio mayor que cero.");
  return cents;
}
export function limaInput(iso: string): string {
  return new Date(Date.parse(iso) - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function fromLimaInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Revisa las fechas del descuento.");
  const date = new Date(`${value}:00-05:00`);
  if (Number.isNaN(date.getTime()) || limaInput(date.toISOString()) !== value)
    throw new Error("Revisa las fechas del descuento.");
  return date.toISOString();
}
export function formatOfferTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function imageExtension(file: Pick<File, "type" | "size">): "jpg" | "png" | "webp" {
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES)
    throw new Error("La foto debe pesar como máximo 5 MB.");
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  throw new Error("Selecciona una foto JPEG, PNG o WebP.");
}
export function validateImageBytes(bytes: Uint8Array, mime: string): void {
  imageExtension({ size: bytes.length, type: mime });
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const isWebp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (mime === "image/jpeg" && isJpeg) ||
    (mime === "image/png" && isPng) ||
    (mime === "image/webp" && isWebp)
  ))
    throw new Error("El contenido de la foto no coincide con su formato.");
}

export function whatsappLink(phone: string, name: string, priceCents: number): string {
  const number = normalizeWhatsapp(phone);
  const message = `Hola, vengo de JAMA y quisiera aprovechar el descuento de ${name} a S/ ${(priceCents / 100).toFixed(2)}. ¿Sigue disponible?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

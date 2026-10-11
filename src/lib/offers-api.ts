import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CategoryDefinition, Product } from "./products";
import {
  IMAGE_BUCKET,
  businessSchema,
  offerSchema,
  offerIdSchema,
  tokenSchema,
  categoryIdSchema,
  validateImageBytes,
  type Business,
  type SellerOffer,
} from "./offers";
import {
  authenticatedInput,
  contactInput,
  imageUrl,
  serverSupabase,
  verifiedUser,
  verifiedContact,
  safeOfferError,
  OfferError,
  type OfferResult,
} from "./offers-service";

const publicProductSchema = z.object({
  id: offerIdSchema,
  name: z.string(),
  description: z.string(),
  category: categoryIdSchema,
  priceCents: z.number().int().positive(),
  originalPriceCents: z.number().int().positive(),
  stock: z.number().int().positive(),
  imagePath: z.string(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  store: z.string(),
  zone: z.string(),
});
export type Catalog = { serverNow: string; items: Product[] };
export const fetchCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<OfferResult<Catalog>> => {
    try {
      const client = serverSupabase();
      const { data, error } = await client.rpc("jama_public_catalog");
      if (error) throw new OfferError("No pudimos cargar las ofertas. Inténtalo nuevamente.");
      const catalog = z
        .object({
          serverNow: z.string().datetime({ offset: true }),
          items: z.array(publicProductSchema),
        })
        .parse(data);
      return {
        ok: true,
        value: {
          serverNow: catalog.serverNow,
          items: catalog.items.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            category: p.category,
            image: imageUrl(p.imagePath),
            store: p.store,
            zone: p.zone,
            price: p.priceCents / 100,
            originalPrice: p.originalPriceCents / 100,
            stock: p.stock,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
          })),
        },
      };
    } catch (error) {
      return safeOfferError(error);
    }
  },
);

export const fetchCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<OfferResult<CategoryDefinition[]>> => {
    try {
      const { data, error } = await serverSupabase()
        .from("jama_categories")
        .select("id, label, emoji, business_enabled, offer_enabled, name_label, description_hint")
        .eq("active", true)
        .order("position")
        .order("id");
      if (error) throw new OfferError("No pudimos cargar las categorías. Inténtalo nuevamente.");
      return {
        ok: true,
        value: (data ?? []).map((c) => ({
          id: c.id,
          label: c.label,
          emoji: c.emoji,
          businessEnabled: c.business_enabled,
          offerEnabled: c.offer_enabled,
          nameLabel: c.name_label,
          descriptionHint: c.description_hint,
        })),
      };
    } catch (error) {
      return safeOfferError(error);
    }
  },
);

const businessColumns = "id, name, zone, whatsapp, category, status, review_note";
const productColumns =
  "id, name, description, category, price_cents, original_price_cents, stock, image_path, starts_at, ends_at, published";
export const fetchSeller = createServerFn({ method: "POST" })
  .inputValidator(authenticatedInput)
  .handler(
    async ({
      data,
    }): Promise<
      OfferResult<{ business: Business | null; offers: SellerOffer[]; serverNow: string }>
    > => {
      try {
        const client = serverSupabase(data.accessToken);
        const user = await verifiedUser(client);
        const { data: business, error } = await client
          .from("businesses")
          .select(businessColumns)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (error) throw new OfferError("No pudimos cargar tu negocio. Inténtalo nuevamente.");
        if (!business)
          return {
            ok: true,
            value: { business: null, offers: [], serverNow: new Date().toISOString() },
          };
        const { data: offers, error: offerError } = await client
          .from("products")
          .select(productColumns)
          .eq("business_id", business.id)
          .order("updated_at", { ascending: false });
        if (offerError)
          throw new OfferError("No pudimos cargar tus ofertas. Inténtalo nuevamente.");
        return {
          ok: true,
          value: {
            business,
            serverNow: new Date().toISOString(),
            offers: (offers ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              category: p.category,
              originalPriceCents: p.original_price_cents,
              priceCents: p.price_cents,
              stock: p.stock,
              imagePath: p.image_path,
              startsAt: p.starts_at,
              endsAt: p.ends_at,
              published: p.published,
            })),
          },
        };
      } catch (error) {
        return safeOfferError(error);
      }
    },
  );

export const saveBusiness = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: tokenSchema, business: businessSchema }).strict())
  .handler(async ({ data }): Promise<OfferResult<Business>> => {
    try {
      const client = serverSupabase(data.accessToken);
      const user = await verifiedUser(client);
      const { data: category, error: categoryError } = await client
        .from("jama_categories")
        .select("id")
        .eq("id", data.business.category)
        .eq("active", true)
        .eq("business_enabled", true)
        .maybeSingle();
      if (categoryError || !category)
        throw new OfferError("Selecciona una categoría de negocio disponible.", "validation");
      const { data: existing, error: readError } = await client
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (readError) throw new OfferError("No pudimos verificar tu negocio.");
      const query = existing
        ? client
            .from("businesses")
            .update(data.business)
            .eq("id", existing.id)
            .eq("owner_id", user.id)
        : client.from("businesses").insert({ ...data.business, owner_id: user.id });
      const { data: business, error } = await query.select(businessColumns).single();
      if (error || !business)
        throw new OfferError(
          "No pudimos guardar el negocio. Revisa sus datos e inténtalo nuevamente.",
        );
      return { ok: true, value: business };
    } catch (error) {
      return safeOfferError(error);
    }
  });

export const saveOfferInput = z
  .object({
    accessToken: tokenSchema,
    offer: offerSchema,
    published: z.boolean(),
    imagePath: z.string().max(200),
  })
  .strict();
export const saveOffer = createServerFn({ method: "POST" })
  .inputValidator(saveOfferInput)
  .handler(async ({ data }): Promise<OfferResult<{ id: string }>> => {
    try {
      const client = serverSupabase(data.accessToken);
      const user = await verifiedUser(client);
      const { data: business, error: businessError } = await client
        .from("businesses")
        .select(businessColumns)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (
        businessError ||
        !business ||
        !businessSchema.safeParse({
          name: business.name,
          zone: business.zone,
          whatsapp: business.whatsapp,
          category: business.category,
        }).success
      )
        throw new OfferError(
          "Registra tu negocio con un WhatsApp válido antes de publicar.",
          "validation",
        );
      if (data.published && business.status !== "approved")
        throw new OfferError(
          "La publicación del negocio está suspendida. Puedes guardar un borrador.",
          "validation",
        );
      const { data: category, error: categoryError } = await client
        .from("jama_categories")
        .select("id")
        .eq("id", data.offer.category)
        .eq("active", true)
        .eq("offer_enabled", true)
        .maybeSingle();
      if (categoryError || !category)
        throw new OfferError("Selecciona una categoría de oferta disponible.", "validation");
      const prefix = `${user.id}/${data.offer.id}/`;
      if (
        !data.imagePath.startsWith(prefix) ||
        !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(data.imagePath)
      )
        throw new OfferError("Selecciona una foto propia para este producto.", "validation");
      // Images go directly to Storage to support 5 MB files without Vercel's
      // request-body limit. The server downloads and validates before publishing.
      const { data: image, error: imageError } = await client.storage
        .from(IMAGE_BUCKET)
        .download(data.imagePath);
      if (imageError || !image)
        throw new OfferError("No pudimos verificar la foto. Vuelve a subirla.");
      if (image.size > 5 * 1024 * 1024)
        throw new OfferError("La foto debe pesar como máximo 5 MB.", "validation");
      try {
        validateImageBytes(new Uint8Array(await image.arrayBuffer()), image.type);
      } catch (error) {
        throw new OfferError((error as Error).message, "validation");
      }
      const { data: existing, error: readError } = await client
        .from("products")
        .select("id, business_id, image_path")
        .eq("id", data.offer.id)
        .maybeSingle();
      if (readError) throw new OfferError("No pudimos verificar la oferta.");
      if (existing && existing.business_id !== business.id)
        throw new OfferError("No puedes editar esta oferta.", "validation");
      const p = data.offer;
      const fields = {
        name: p.name,
        description: p.description,
        category: p.category,
        original_price_cents: p.originalPriceCents,
        price_cents: p.priceCents,
        stock: p.stock,
        starts_at: p.startsAt,
        ends_at: p.endsAt,
        image_path: data.imagePath,
        published: data.published,
      };
      const query = existing
        ? client.from("products").update(fields).eq("id", p.id).eq("business_id", business.id)
        : client.from("products").insert({ ...fields, id: p.id, business_id: business.id });
      const { data: saved, error } = await query.select("id").single();
      if (error || !saved)
        throw new OfferError(
          "No pudimos guardar la oferta. Revisa sus datos e inténtalo nuevamente.",
        );
      if (existing?.image_path && existing.image_path !== data.imagePath)
        await client.storage.from(IMAGE_BUCKET).remove([existing.image_path]);
      return { ok: true, value: { id: saved.id } };
    } catch (error) {
      return safeOfferError(error);
    }
  });

export const changeOffer = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        accessToken: tokenSchema,
        offerId: offerIdSchema,
        action: z.enum(["pause", "activate", "delete"]),
      })
      .strict(),
  )
  .handler(async ({ data }): Promise<OfferResult<{ id: string }>> => {
    try {
      const client = serverSupabase(data.accessToken);
      const user = await verifiedUser(client);
      const { data: business } = await client
        .from("businesses")
        .select("id, status")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!business) throw new OfferError("No pudimos encontrar tu negocio.");
      if (data.action === "activate" && business.status !== "approved")
        throw new OfferError("La publicación del negocio está suspendida.", "validation");
      const { data: offer, error } = await client
        .from("products")
        .select("id, image_path, ends_at, stock")
        .eq("id", data.offerId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (error || !offer) throw new OfferError("No pudimos encontrar esta oferta.");
      if (
        data.action === "activate" &&
        (Date.parse(offer.ends_at) <= Date.now() || offer.stock < 1)
      )
        throw new OfferError(
          "Actualiza la fecha y la cantidad antes de reactivar la oferta.",
          "validation",
        );
      const query =
        data.action === "delete"
          ? client.from("products").delete()
          : client.from("products").update({ published: data.action === "activate" });
      const { data: changed, error: changeError } = await query
        .eq("id", data.offerId)
        .eq("business_id", business.id)
        .select("id")
        .single();
      if (changeError || !changed)
        throw new OfferError("No pudimos actualizar la oferta. Inténtalo nuevamente.");
      if (data.action === "delete")
        await client.storage.from(IMAGE_BUCKET).remove([offer.image_path]);
      return { ok: true, value: { id: data.offerId } };
    } catch (error) {
      return safeOfferError(error);
    }
  });

export const contactOffer = createServerFn({ method: "POST" })
  .inputValidator(contactInput)
  .handler(async ({ data }) => {
    try {
      return await verifiedContact(serverSupabase(data.accessToken), data.offerId);
    } catch (error) {
      return safeOfferError(error);
    }
  });

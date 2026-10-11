import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "./supabase";
import { IMAGE_BUCKET, offerIdSchema, tokenSchema, whatsappLink } from "./offers";

export type OfferFailure = {
  ok: false;
  reason: "session" | "unavailable" | "validation";
  message: string;
};
export type OfferResult<T> = { ok: true; value: T } | OfferFailure;
export class OfferError extends Error {
  constructor(
    message: string,
    public reason: OfferFailure["reason"] = "unavailable",
  ) {
    super(message);
  }
}
export function safeOfferError(error: unknown): OfferFailure {
  return error instanceof OfferError
    ? { ok: false, reason: error.reason, message: error.message }
    : {
        ok: false,
        reason: "unavailable",
        message: "No pudimos completar la solicitud. Inténtalo nuevamente.",
      };
}
export function serverSupabase(accessToken?: string): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config)
    throw new OfferError("Estamos preparando las ofertas. Vuelve a intentarlo más tarde.");
  return createClient(config.url, config.key, {
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export async function verifiedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (
    error &&
    (error.name === "AuthRetryableFetchError" || error.status === 0 || (error.status ?? 0) >= 500)
  )
    throw new OfferError("No pudimos verificar tu sesión. Inténtalo nuevamente.");
  if (error || !data.user) throw new OfferError("Inicia sesión para continuar.", "session");
  return data.user;
}
export async function verifiedAdmin(client: SupabaseClient) {
  const user = await verifiedUser(client);
  const { data, error } = await client.rpc("jama_is_admin");
  if (error) throw new OfferError("No pudimos comprobar tus permisos. Inténtalo nuevamente.");
  if (data !== true)
    throw new OfferError("No tienes permisos para revisar negocios.", "validation");
  return user;
}
export const authenticatedInput = z.object({ accessToken: tokenSchema }).strict();
export const contactInput = z.object({ accessToken: tokenSchema, offerId: offerIdSchema }).strict();
export function imageUrl(path: string): string {
  const config = getSupabaseConfig();
  if (!config || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path))
    return "";
  return `${config.url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
const contactSchema = z.object({
  id: offerIdSchema,
  name: z.string().min(3).max(120),
  priceCents: z.number().int().positive(),
  whatsapp: z.string(),
  endsAt: z.string().datetime({ offset: true }),
  serverNow: z.string().datetime({ offset: true }),
});
export async function verifiedContact(
  client: SupabaseClient,
  offerId: string,
): Promise<OfferResult<{ url: string; endsAt: string; serverNow: string }>> {
  try {
    await verifiedUser(client);
    const { data, error } = await client.rpc("jama_contact_offer", { offer_id: offerId });
    if (error)
      throw new OfferError("Este descuento ya no está disponible. Revisa las ofertas actuales.");
    const offer = contactSchema.parse(data);
    if (offer.id !== offerId || Date.parse(offer.endsAt) <= Date.parse(offer.serverNow))
      throw new OfferError("Este descuento ya no está disponible.");
    return {
      ok: true,
      value: {
        url: whatsappLink(offer.whatsapp, offer.name, offer.priceCents),
        endsAt: offer.endsAt,
        serverNow: offer.serverNow,
      },
    };
  } catch (error) {
    return safeOfferError(error);
  }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Business } from "./offers";
import { offerIdSchema, tokenSchema } from "./offers";
import {
  authenticatedInput,
  OfferError,
  safeOfferError,
  serverSupabase,
  verifiedAdmin,
  verifiedUser,
  type OfferResult,
} from "./offers-service";

export const fetchAdminAccess = createServerFn({ method: "POST" })
  .inputValidator(authenticatedInput)
  .handler(async ({ data }): Promise<OfferResult<boolean>> => {
    try {
      const client = serverSupabase(data.accessToken);
      await verifiedUser(client);
      const { data: isAdmin, error } = await client.rpc("jama_is_admin");
      if (error) throw new OfferError("No pudimos comprobar tus permisos.");
      return { ok: true, value: isAdmin === true };
    } catch (error) {
      return safeOfferError(error);
    }
  });

export type BusinessReview = Business & { created_at: string; reviewed_at: string | null };
export const fetchBusinessReviews = createServerFn({ method: "POST" })
  .inputValidator(authenticatedInput)
  .handler(async ({ data }): Promise<OfferResult<BusinessReview[]>> => {
    try {
      const client = serverSupabase(data.accessToken);
      await verifiedAdmin(client);
      const { data: businesses, error } = await client
        .from("businesses")
        .select("id, name, zone, whatsapp, category, status, review_note, created_at, reviewed_at")
        .order("created_at", { ascending: true });
      if (error) throw new OfferError("No pudimos cargar las solicitudes.");
      return { ok: true, value: businesses ?? [] };
    } catch (error) {
      return safeOfferError(error);
    }
  });

export const reviewBusinessInput = z
  .object({
    accessToken: tokenSchema,
    businessId: offerIdSchema,
    decision: z.enum(["approved", "rejected", "pending"]),
    note: z.string().trim().max(1000),
  })
  .strict();
export const reviewBusiness = createServerFn({ method: "POST" })
  .inputValidator(reviewBusinessInput)
  .handler(async ({ data }): Promise<OfferResult<{ id: string }>> => {
    try {
      const client = serverSupabase(data.accessToken);
      await verifiedAdmin(client);
      const { error } = await client.rpc("jama_review_business", {
        target_business: data.businessId,
        decision: data.decision,
        note: data.note,
      });
      if (error)
        throw new OfferError(
          "No pudimos guardar la revisión. Comprueba la categoría y vuelve a intentarlo.",
        );
      return { ok: true, value: { id: data.businessId } };
    } catch (error) {
      return safeOfferError(error);
    }
  });

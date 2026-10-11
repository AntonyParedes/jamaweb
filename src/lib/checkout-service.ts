import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const item = z
  .object({ productId: z.string().min(1).max(100), qty: z.number().int().min(1).max(100) })
  .strict();
export const checkoutInputSchema = z
  .object({
    accessToken: z.string().min(1).max(16384),
    items: z
      .array(item)
      .min(1)
      .max(50)
      .refine(
        (items) => new Set(items.map((entry) => entry.productId)).size === items.length,
        "Productos duplicados.",
      ),
  })
  .strict();
const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        qty: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
        subtotalCents: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  totalCents: z.number().int().nonnegative(),
  currency: z.literal("PEN"),
  expiresAt: z.string().datetime(),
});
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; reason: "session" | "configuration" | "unavailable"; message: string };

// Called on the server with a client scoped to the submitted access token.
// Only authoritative database values can produce a checkout quote.
export async function getVerifiedQuote(
  client: SupabaseClient,
  items: z.infer<typeof item>[],
): Promise<QuoteResult> {
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (
      authError &&
      (authError.name === "AuthRetryableFetchError" ||
        authError.status === 0 ||
        (authError.status ?? 0) >= 500)
    ) {
      return {
        ok: false,
        reason: "unavailable",
        message: "No pudimos verificar tu sesión. Inténtalo nuevamente.",
      };
    }
    if (authError || !auth.user)
      return {
        ok: false,
        reason: "session",
        message: "Tu sesión venció. Inicia sesión para continuar.",
      };
    const { data, error } = await client.rpc("jama_checkout_quote", { requested_items: items });
    if (error)
      return {
        ok: false,
        reason: "unavailable",
        message:
          "No pudimos verificar tu carrito. Revisa la disponibilidad o inténtalo nuevamente.",
      };
    const result = quoteSchema.safeParse(data);
    if (!result.success)
      return {
        ok: false,
        reason: "unavailable",
        message: "No pudimos verificar tu carrito. Inténtalo nuevamente.",
      };
    const quote = result.data;
    const matches =
      quote.items.length === items.length &&
      new Set(quote.items.map((entry) => entry.productId)).size === items.length &&
      quote.items.every(
        (entry) =>
          items.some(
            (requested) => requested.productId === entry.productId && requested.qty === entry.qty,
          ) && entry.subtotalCents === entry.unitPriceCents * entry.qty,
      );
    if (
      !matches ||
      quote.totalCents !== quote.items.reduce((sum, entry) => sum + entry.subtotalCents, 0) ||
      Date.parse(quote.expiresAt) <= Date.now()
    )
      return {
        ok: false,
        reason: "unavailable",
        message: "La verificación del carrito venció. Vuelve a verificarlo.",
      };
    return { ok: true, quote };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "No pudimos verificar tu carrito. Inténtalo nuevamente.",
    };
  }
}

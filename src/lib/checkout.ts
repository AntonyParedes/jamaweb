import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabase";
import { checkoutInputSchema, getVerifiedQuote, type QuoteResult } from "./checkout-service";

export const requestCheckoutQuote = createServerFn({ method: "POST" })
  .inputValidator(checkoutInputSchema)
  .handler(async ({ data }): Promise<QuoteResult> => {
    const config = getSupabaseConfig();
    if (!config)
      return {
        ok: false,
        reason: "configuration",
        message: "Estamos preparando el checkout. Puedes conservar tu carrito y seguir explorando.",
      };
    // A fresh client per request avoids leaking sessions across SSR users.
    const client = createClient(config.url, config.key, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return getVerifiedQuote(client, data.items);
  });

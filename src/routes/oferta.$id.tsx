import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/jama/AppShell";
import { CatalogNotice } from "@/components/jama/CatalogNotice";
import { useCatalog } from "@/lib/catalog";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { contactOffer } from "@/lib/offers-api";
import { formatOfferTime, offerIdSchema } from "@/lib/offers";
import { discountLabel } from "@/lib/products";

export const Route = createFileRoute("/oferta/$id")({
  head: () => ({ meta: [{ title: "Descuento del negocio — JAMA" }] }),
  component: Oferta,
});
export function Oferta() {
  const { id } = Route.useParams();
  const { products, loading, error: catalogError, refresh } = useCatalog();
  const { session, loading: authLoading, recovery } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const product = products.find((p) => p.id === id);
  async function contact() {
    if (busy.current || authLoading || !offerIdSchema.safeParse(id).success) return;
    if (!session || recovery) {
      void navigate({
        to: "/acceso",
        search: { next: `/oferta/${id}`, mode: recovery ? "reset" : "login" },
      });
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const started = performance.now();
      const result = await contactOffer({
        data: { accessToken: session.access_token, offerId: id },
      });
      if (!result.ok) {
        setError(result.message);
        if (result.reason === "session") {
          await getSupabase()?.auth.signOut({ scope: "local" });
          void navigate({ to: "/acceso", search: { next: `/oferta/${id}`, mode: "login" } });
        }
        return;
      }
      if (
        Date.parse(result.value.endsAt) - Date.parse(result.value.serverNow) <=
        performance.now() - started
      ) {
        setError("Este descuento acaba de vencer. Revisa las ofertas actuales.");
        void refresh();
        return;
      }
      // Same-tab navigation avoids pop-up blocking after asynchronous checks.
      // Only a deliberate click reaches here; no messages are sent by JAMA.
      window.location.assign(result.value.url);
    } catch {
      setError("No pudimos verificar este descuento. Inténtalo nuevamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Link to="/explorar" className="inline-flex min-h-11 items-center font-bold underline">
          Volver a las ofertas
        </Link>
        <CatalogNotice loading={loading} error={catalogError} retry={refresh} />
        {!loading && !catalogError && !product && (
          <div className="rounded-2xl bg-muted p-5">
            <h1 className="text-xl font-black">Este descuento no está disponible</h1>
            <p className="mt-2 text-sm">
              Puede haber terminado, estar pausado o haberse agotado. Explora las ofertas actuales.
            </p>
          </div>
        )}
        {product && (
          <article className="overflow-hidden rounded-3xl bg-card shadow-soft">
            <img
              src={product.image}
              alt={product.name}
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="space-y-4 p-5">
              <span className="inline-block rounded-full bg-lime px-3 py-1 text-sm font-black">
                -{discountLabel(product.price, product.originalPrice)}%
              </span>
              <h1 className="break-words text-2xl font-black">{product.name}</h1>
              <p className="break-words text-sm font-bold">
                {product.store} · {product.zone}
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-black">S/ {product.price.toFixed(2)}</span>
                <span className="text-muted-foreground line-through">
                  S/ {product.originalPrice.toFixed(2)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{product.description}</p>
              <p className="text-sm">
                {product.stock} disponibles · Hasta {formatOfferTime(product.endsAt)} (hora de Perú)
              </p>
              <button
                disabled={pending || authLoading}
                onClick={() => void contact()}
                className="press min-h-13 w-full rounded-full bg-lime px-4 py-3 font-black disabled:opacity-50"
              >
                {pending
                  ? "Verificando descuento…"
                  : authLoading
                    ? "Comprobando sesión…"
                    : "Quiero este descuento"}
              </button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {!session && "Te pediremos iniciar sesión antes de contactar. "}Abriremos el
                WhatsApp del negocio con un mensaje de JAMA. La disponibilidad final, el pago y el
                recojo se coordinan con el vendedor. Este contacto no reserva productos ni confirma
                una compra.
              </p>
            </div>
          </article>
        )}
      </section>
    </AppShell>
  );
}

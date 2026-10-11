import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/jama/AppShell";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { getSupabase } from "@/lib/supabase";
import { requestCheckoutQuote } from "@/lib/checkout";
import type { Quote } from "@/lib/checkout-service";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — JAMA" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});
export function Checkout() {
  const { session, loading, recovery } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!loading && (!session || recovery))
      void navigate({
        to: "/acceso",
        search: { next: "/checkout", mode: recovery ? "reset" : "login" },
        replace: true,
      });
  }, [session, loading, recovery, navigate]);
  useEffect(() => {
    setQuote(null);
    setError("");
    if (loading || !session || recovery || !cart.length) return;
    let active = true;
    setChecking(true);
    void requestCheckoutQuote({ data: { accessToken: session.access_token, items: cart } })
      .then(async (result) => {
        if (!active) return;
        if (result.ok) setQuote(result.quote);
        else if (result.reason === "session") {
          await getSupabase()?.auth.signOut({ scope: "local" });
          if (active) {
            setError(result.message);
            void navigate({
              to: "/acceso",
              search: { next: "/checkout", mode: "login" },
              replace: true,
            });
          }
        } else setError(result.message);
      })
      .catch(() => {
        if (active) setError("No pudimos verificar tu carrito. Inténtalo nuevamente.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [session, loading, recovery, cart, revision, navigate]);
  useEffect(() => {
    if (!quote) return;
    const timer = window.setTimeout(
      () => {
        setQuote(null);
        setError("La verificación venció. Vuelve a verificar tu carrito.");
      },
      Math.max(0, Date.parse(quote.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [quote]);
  // Private checkout contents are not rendered during SSR or for a guest.
  if (loading || !session || recovery)
    return (
      <AppShell>
        <section className="mx-auto max-w-2xl px-4 py-6">
          <p role="status">Comprobando tu sesión…</p>
        </section>
      </AppShell>
    );
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <LockKeyhole className="shrink-0" />
          Checkout
        </h1>
        {!cart.length ? (
          <>
            <p>Tu carrito está vacío.</p>
            <Link
              to="/explorar"
              className="inline-flex min-h-12 items-center rounded-full bg-lime px-6 font-black"
            >
              Explorar ofertas
            </Link>
          </>
        ) : (
          <>
            {checking && <p role="status">Verificando precios y disponibilidad…</p>}
            {error && (
              <p role="alert" className="rounded-xl bg-muted p-4 text-sm">
                {error}
              </p>
            )}
            {quote && (
              <div className="rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 text-lg font-black">Carrito verificado</h2>
                <ul className="space-y-3">
                  {quote.items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex flex-wrap justify-between gap-x-4 gap-y-1"
                    >
                      <span className="min-w-0 flex-1 basis-40 break-words">
                        {item.qty} × {item.name}
                      </span>
                      <span className="shrink-0 font-bold">
                        S/ {(item.subtotalCents / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-right text-xl font-black">
                  Total: S/ {(quote.totalCents / 100).toFixed(2)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Estos precios vienen del catálogo actualizado. La verificación no reserva stock ni
                  confirma una compra.
                </p>
              </div>
            )}
            <button
              disabled={checking}
              onClick={() => setRevision((value) => value + 1)}
              className="press inline-flex min-h-12 items-center gap-2 rounded-full border px-5 font-bold disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
              Volver a verificar
            </button>
            <div className="rounded-2xl bg-muted p-5">
              <h2 className="font-black">El pago estará disponible pronto</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Aún no se procesan pagos desde JAMA. No se ha realizado ningún cobro ni creado un
                pedido.
              </p>
              <button
                disabled
                className="mt-4 min-h-12 w-full rounded-full bg-navy px-5 font-black text-navy-foreground opacity-50"
              >
                Pago todavía no disponible
              </button>
            </div>
            <Link to="/carrito" className="inline-flex min-h-11 items-center font-bold underline">
              Volver al carrito
            </Link>
          </>
        )}
      </section>
    </AppShell>
  );
}

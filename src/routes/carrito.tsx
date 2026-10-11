import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { AppShell } from "@/components/jama/AppShell";
import { CatalogNotice } from "@/components/jama/CatalogNotice";
import { useCatalog } from "@/lib/catalog";
import { useCart, setCartQuantity } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/carrito")({
  head: () => ({ meta: [{ title: "Mi carrito — JAMA" }, { name: "robots", content: "noindex" }] }),
  component: Carrito,
});
export function Carrito() {
  const { products, loading: catalogLoading, error: catalogError, refresh } = useCatalog();
  const cart = useCart();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const total = cart.reduce(
    (sum, item) =>
      sum + (products.find((product) => product.id === item.productId)?.price ?? 0) * item.qty,
    0,
  );
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <ShoppingCart className="shrink-0" />
          Mi carrito
        </h1>
        <CatalogNotice loading={catalogLoading} error={catalogError} retry={refresh} />
        {!cart.length ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="font-bold">Tu carrito está vacío.</p>
            <Link
              to="/explorar"
              className="mt-3 inline-flex min-h-12 items-center rounded-full bg-lime px-6 font-black"
            >
              Explorar ofertas
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {cart.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);
                return (
                  <li key={item.productId} className="rounded-2xl bg-card p-4 shadow-soft">
                    <div className="flex items-center gap-3">
                      {product && (
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={64}
                          height={64}
                          className="size-14 shrink-0 rounded-xl object-cover sm:size-16"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="break-words font-extrabold">
                          {product?.name ?? "Producto no disponible"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {product
                            ? `S/ ${(product.price * item.qty).toFixed(2)} · precio estimado`
                            : "Elimina este producto para continuar."}
                        </p>
                      </div>
                      <button
                        aria-label={`Eliminar ${product?.name ?? "producto"}`}
                        onClick={() => setCartQuantity(item.productId, 0)}
                        className="press grid size-11 shrink-0 place-items-center rounded-full"
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        aria-label={`Reducir cantidad de ${product?.name ?? "producto"}`}
                        disabled={item.qty === 1}
                        onClick={() => setCartQuantity(item.productId, item.qty - 1)}
                        className="press grid size-11 place-items-center rounded-full bg-muted disabled:opacity-50"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="font-black">{item.qty}</span>
                      <button
                        aria-label={`Aumentar cantidad de ${product?.name ?? "producto"}`}
                        disabled={!product || item.qty >= Math.min(product.stock, 100)}
                        onClick={() => setCartQuantity(item.productId, item.qty + 1)}
                        className="press grid size-11 place-items-center rounded-full bg-muted disabled:opacity-50"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-right text-xl font-black">Total estimado: S/ {total.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              Verificaremos los precios y la disponibilidad antes de pagar. El carrito no reserva
              productos.
            </p>
            <button
              disabled={
                loading ||
                catalogLoading ||
                !!catalogError ||
                cart.some((item) => !products.some((product) => product.id === item.productId))
              }
              onClick={() => {
                if (session) void navigate({ to: "/checkout" });
                else void navigate({ to: "/acceso", search: { next: "/checkout", mode: "login" } });
              }}
              className="press min-h-13 w-full rounded-full bg-lime px-5 py-3.5 text-lg font-black disabled:opacity-50"
            >
              {loading ? "Comprobando sesión…" : "Continuar al pago"}
            </button>
          </>
        )}
      </section>
    </AppShell>
  );
}

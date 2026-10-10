import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { AppShell } from "@/components/jama/AppShell";
import { ProductGrid } from "@/components/jama/ProductCard";
import { ProductSheet } from "@/components/jama/ProductSheet";
import { PRODUCTS, type Product } from "@/lib/products";
import { useJama } from "@/lib/store";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Mis favoritos — JAMA" },
      { name: "description", content: "Tus ofertas guardadas de pastelerías y panaderías." },
      { property: "og:title", content: "Mis favoritos — JAMA" },
      { property: "og:description", content: "Tus ofertas guardadas en JAMA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Favoritos,
});

function Favoritos() {
  const { favorites } = useJama();
  const [open, setOpen] = useState<Product | null>(null);
  const list = PRODUCTS.filter((p) => favorites.includes(p.id));
  return (
    <AppShell>
      <section className="mx-auto max-w-6xl px-4 pt-5">
        <h1 className="mb-4 text-3xl font-black">Favoritos</h1>
        {list.length ? (
          <ProductGrid products={list} onOpen={setOpen} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-lime text-lime-foreground">
              <Heart className="size-9" />
            </span>
            <p className="font-bold">Aún no guardas ofertas</p>
            <Link to="/explorar" className="press inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-black text-navy-foreground">
              Explorar <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { AppShell } from "@/components/jama/AppShell";
import { ProductGrid } from "@/components/jama/ProductCard";
import { ProductSheet } from "@/components/jama/ProductSheet";
import { CATEGORIES, PRODUCTS, type Category, type Product } from "@/lib/products";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar ofertas de hoy — JAMA" },
      { name: "description", content: "Tortas, pan y postres de hoy con descuento real en Ayacucho." },
      { property: "og:title", content: "Explorar ofertas de hoy — JAMA" },
      { property: "og:description", content: "Tortas, pan y postres de hoy con descuento real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explorar,
});

function Explorar() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "todos">("todos");
  const [open, setOpen] = useState<Product | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return PRODUCTS.filter(
      (p) =>
        (cat === "todos" || p.category === cat) &&
        (!t || p.name.toLowerCase().includes(t) || p.store.toLowerCase().includes(t)),
    );
  }, [q, cat]);

  return (
    <AppShell>
      <div className="sticky top-14 z-20 bg-background/95 pb-2 pt-3 backdrop-blur md:top-16">
        <div className="mx-auto max-w-6xl px-4">
          <label className="flex min-h-12 items-center gap-2 rounded-full border bg-card px-4 shadow-soft">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Busca tortas, pan, locales…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </label>
        </div>
        <div className="scrollbar-none mx-auto mt-3 flex max-w-6xl gap-2 overflow-x-auto px-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className="press min-h-11 shrink-0 rounded-full border bg-card px-4 text-sm font-bold aria-pressed:border-lime aria-pressed:bg-lime aria-pressed:text-lime-foreground"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>
      <section className="mx-auto max-w-6xl px-4 pt-3">
        <p className="mb-3 text-sm text-muted-foreground">{list.length} ofertas hoy</p>
        {list.length ? (
          <ProductGrid products={list} onOpen={setOpen} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <SearchX className="size-10" />
            <p className="font-bold">Sin resultados</p>
          </div>
        )}
      </section>
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}

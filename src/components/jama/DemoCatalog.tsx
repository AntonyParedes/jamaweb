import { useState } from "react";
import { demoProducts } from "@/lib/demo-products";
import type { Product } from "@/lib/products";
import { ProductGrid } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";

export function DemoCatalog({
  search = "",
  category = "todos",
}: {
  search?: string;
  category?: string;
}) {
  const [open, setOpen] = useState<Product | null>(null);
  const filtered = demoProducts.filter(
    (p) =>
      (category === "todos" || p.category === category) &&
      p.name.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")),
  );
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-muted p-4 text-sm" role="status">
        <h3 className="font-black">Ejemplos de ofertas</h3>
        <p>
          20 ejemplos con fotos ilustrativas para conocer JAMA. Los precios son de demostración;
          estos productos no están disponibles para comprar.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Las ofertas reales se muestran por separado.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "ejemplo" : "ejemplos"}
      </p>
      <ProductGrid products={filtered} onOpen={setOpen} />
      {!filtered.length && (
        <p className="py-6 text-muted-foreground">No hay ejemplos con esos filtros.</p>
      )}
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </div>
  );
}

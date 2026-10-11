import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { demoProducts } from "@/lib/demo-products";
import type { Product } from "@/lib/products";
import { ProductCard } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";

export function DemoCatalog({
  search = "",
  category = "todos",
}: {
  search?: string;
  category?: string;
}) {
  const [open, setOpen] = useState<Product | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    const element = track.current;
    if (element)
      element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };
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
          Fotos y logos ilustrativos para conocer JAMA. Los precios son de demostración; estos
          productos no están disponibles para comprar.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Las ofertas reales se muestran por separado.
        </p>
      </div>
      {!!filtered.length && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Desliza para descubrir más</p>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Ejemplos anteriores"
              onClick={() => scroll(-1)}
              className="press grid size-11 place-items-center rounded-full bg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Ejemplos siguientes"
              onClick={() => scroll(1)}
              className="press grid size-11 place-items-center rounded-full bg-muted"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}
      <div
        ref={track}
        tabIndex={0}
        aria-label="Explorar ejemplos de ofertas"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-navy"
      >
        {filtered.map((product) => (
          <div
            key={product.id}
            className="w-[75%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%]"
          >
            <ProductCard product={product} onOpen={setOpen} />
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p className="py-6 text-muted-foreground">No hay ejemplos con esos filtros.</p>
      )}
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </div>
  );
}

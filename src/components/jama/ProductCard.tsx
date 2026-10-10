import { Clock3, Heart } from "lucide-react";
import { toast } from "sonner";
import { discountPercent, type Product } from "@/lib/products";
import { toggleFavorite, useJama } from "@/lib/store";

export function ProductCard({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  const { favorites } = useJama();
  const fav = favorites.includes(product.id);
  const pct = discountPercent(product.price, product.originalPrice);

  return (
    <article className="relative overflow-hidden rounded-2xl bg-card shadow-soft">
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="press block w-full text-left"
        aria-label={`Ver ${product.name}`}
      >
        <div className="relative aspect-square bg-muted">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            width={816}
            height={816}
            className="h-full w-full object-cover"
          />
          <span className="absolute left-2 top-2 rounded-full bg-lime px-2 py-1 text-xs font-black text-lime-foreground">
            -{pct}%
          </span>
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-extrabold leading-tight">{product.name}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black">S/ {product.price}</span>
            <span className="text-xs text-muted-foreground line-through">S/ {product.originalPrice}</span>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0" />
            <span className="truncate">{product.pickup}</span>
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => {
          const added = toggleFavorite(product.id);
          toast(added ? "Guardado en favoritos" : "Quitado de favoritos");
        }}
        aria-label={fav ? "Quitar de favoritos" : "Agregar a favoritos"}
        aria-pressed={fav}
        className="press absolute right-1 top-1 grid size-11 place-items-center"
      >
        <span className="grid size-9 place-items-center rounded-full bg-card/90 shadow-soft">
          <Heart className={`size-4 ${fav ? "fill-destructive text-destructive" : ""}`} />
        </span>
      </button>
    </article>
  );
}

export function ProductGrid({ products, onOpen }: { products: Product[]; onOpen: (p: Product) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onOpen={onOpen} />
      ))}
    </div>
  );
}

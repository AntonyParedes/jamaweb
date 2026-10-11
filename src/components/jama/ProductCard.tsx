import { Clock3, Heart } from "lucide-react";
import { toast } from "sonner";
import { discountLabel, type Product } from "@/lib/products";
import { toggleFavorite, useJama } from "@/lib/store";
import { formatOfferTime } from "@/lib/offers";

export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const { favorites } = useJama();
  const fav = favorites.includes(product.id);
  const pct = discountLabel(product.price, product.originalPrice);

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
            decoding="async"
            width={816}
            height={816}
            className="h-full w-full object-cover"
          />
          <span className="absolute left-2 top-2 rounded-full bg-lime px-2 py-1 text-xs font-black text-lime-foreground">
            -{pct}%
          </span>
        </div>
        <div className="space-y-1 p-2.5 sm:p-3">
          <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-extrabold leading-tight">
            {product.name}
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 sm:gap-x-2">
            <span className="text-base font-black sm:text-lg">S/ {product.price.toFixed(2)}</span>
            <span className="text-[11px] text-muted-foreground line-through sm:text-xs">
              S/ {product.originalPrice.toFixed(2)}
            </span>
          </div>
          <p className="truncate text-xs font-bold">{product.store}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0" />
            <span className="truncate">Hasta {formatOfferTime(product.endsAt)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{product.stock} disponibles</p>
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

export function ProductGrid({
  products,
  onOpen,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onOpen={onOpen} />
      ))}
    </div>
  );
}

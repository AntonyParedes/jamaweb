import type { Product } from "@/lib/products";

export function ProductPhoto({ product }: { product: Product }) {
  return (
    <div className="relative aspect-square overflow-hidden bg-muted">
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        decoding="async"
        className={product.imageTile ? "absolute max-w-none" : "h-full w-full object-cover"}
        style={
          product.imageTile
            ? {
                width: "500%",
                height: "400%",
                left: `${-100 * product.imageTile.column}%`,
                top: `${-100 * product.imageTile.row}%`,
              }
            : undefined
        }
        width={816}
        height={816}
      />
    </div>
  );
}

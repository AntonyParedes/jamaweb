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
                width: `${(100 * product.imageTile.sheetWidth) / product.imageTile.width}%`,
                height: `${(100 * product.imageTile.sheetHeight) / product.imageTile.height}%`,
                left: `${(-100 * product.imageTile.left) / product.imageTile.width}%`,
                top: `${(-100 * product.imageTile.top) / product.imageTile.height}%`,
              }
            : undefined
        }
        width={816}
        height={816}
      />
    </div>
  );
}

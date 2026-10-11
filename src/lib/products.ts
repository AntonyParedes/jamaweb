export type Category = string;
export type CategoryDefinition = {
  id: Category;
  label: string;
  emoji: string;
  businessEnabled: boolean;
  offerEnabled: boolean;
  nameLabel: string;
  descriptionHint: string;
};

export type Product = {
  id: string;
  name: string;
  store: string;
  zone: string;
  category: Category;
  image: string;
  price: number;
  originalPrice: number;
  description: string;
  startsAt: string;
  endsAt: string;
  stock: number;
  demo?: boolean;
  imageTile?: {
    left: number;
    top: number;
    width: number;
    height: number;
    sheetWidth: number;
    sheetHeight: number;
  };
};

export function discountPercent(price: number, original: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(original) || price <= 0 || original <= price)
    return 0;
  const priceCents = Math.round(price * 100);
  const originalCents = Math.round(original * 100);
  return ((originalCents - priceCents) / originalCents) * 100;
}

// Display up to two decimals without inflating the advertised percentage.
export function discountLabel(price: number, original: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(
    Math.floor((discountPercent(price, original) + 1e-10) * 100) / 100,
  );
}

export function availableProducts(products: Product[], serverNow: number): Product[] {
  return products
    .filter((p) => {
      const start = Date.parse(p.startsAt),
        end = Date.parse(p.endsAt);
      return (
        Number.isInteger(p.stock) &&
        p.stock > 0 &&
        p.stock <= 100000 &&
        discountPercent(p.price, p.originalPrice) > 0 &&
        p.originalPrice <= 1000000 &&
        start <= serverNow &&
        end > serverNow &&
        end > start
      );
    })
    .sort((a, b) => {
      // Exact cross multiplication in cents: rounded display badges never determine order.
      const aOriginal = BigInt(Math.round(a.originalPrice * 100));
      const bOriginal = BigInt(Math.round(b.originalPrice * 100));
      const left = (aOriginal - BigInt(Math.round(a.price * 100))) * bOriginal;
      const right = (bOriginal - BigInt(Math.round(b.price * 100))) * aOriginal;
      if (left !== right) return left > right ? -1 : 1;
      return Date.parse(a.endsAt) - Date.parse(b.endsAt) || a.id.localeCompare(b.id);
    });
}

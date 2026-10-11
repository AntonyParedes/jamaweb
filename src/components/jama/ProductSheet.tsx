import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, Clock3, MapPin, Minus, Plus, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { discountLabel, type Product } from "@/lib/products";
import { addToCart } from "@/lib/cart";
import { formatOfferTime } from "@/lib/offers";
import { ProductPhoto } from "./ProductPhoto";

export function ProductSheet({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  useEffect(() => {
    setQty(1);
  }, [product?.id]);
  useEffect(() => {
    setQty((current) => Math.min(current, Math.max(1, Math.min(100, product?.stock ?? 1))));
  }, [product?.stock]);
  if (!product) return null;
  const pct = discountLabel(product.price, product.originalPrice);
  if (product.demo)
    return (
      <Drawer open onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg">
          <div className="overflow-y-auto px-4 pb-6">
            <ProductPhoto product={product} />
            <DrawerTitle className="mt-4 text-xl font-black">{product.name}</DrawerTitle>
            <DrawerDescription className="mt-2 rounded-xl bg-muted p-3">
              Ejemplo de demostración con foto ilustrativa. No está disponible para comprar, agregar
              al carrito ni contactar a un vendedor.
            </DrawerDescription>
            <p className="mt-3">{product.description}</p>
            <p className="mt-3 font-black">
              Precio de ejemplo: S/ {product.price.toFixed(2)}{" "}
              <span className="ml-2 font-normal line-through">
                S/ {product.originalPrice.toFixed(2)}
              </span>{" "}
              · -{pct}%
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 min-h-12 w-full rounded-full bg-lime font-black"
            >
              Cerrar ejemplo
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Drawer open={!!product} onOpenChange={(open) => !open && onClose()} repositionInputs>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg">
        <div className="pb-safe overflow-y-auto px-4">
          <div className="relative mt-2 overflow-hidden rounded-2xl">
            <img
              src={product.image}
              alt={product.name}
              className="aspect-[4/3] w-full object-cover"
            />
            <span className="absolute left-3 top-3 rounded-full bg-lime px-3 py-1 text-sm font-black text-lime-foreground">
              -{pct}%
            </span>
          </div>
          <DrawerTitle className="mt-4 text-xl font-black leading-tight">
            {product.name}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Detalle del producto y cantidad para tu carrito
          </DrawerDescription>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-black">S/ {product.price.toFixed(2)}</span>
            <span className="text-muted-foreground line-through">
              S/ {product.originalPrice.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-muted-foreground">
              Ahorras S/ {(product.originalPrice - product.price).toFixed(2)}
            </span>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Info
              icon={CalendarCheck}
              label="Inicio del descuento"
              value={formatOfferTime(product.startsAt)}
            />
            <Info icon={Clock3} label="Fin del descuento" value={formatOfferTime(product.endsAt)} />
            <Info icon={Store} label="Local" value={product.store} />
            <Info icon={MapPin} label="Zona" value={product.zone} />
          </ul>
          {product.description && (
            <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{product.description}</p>
          )}
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            {product.stock} disponibles. Confirma el recojo con el negocio.
          </p>
          <Link
            to="/oferta/$id"
            params={{ id: product.id }}
            onClick={onClose}
            className="press mt-5 flex min-h-13 w-full items-center justify-center rounded-full bg-navy px-4 py-3 font-black text-navy-foreground"
          >
            Quiero este descuento
          </Link>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Ingresa con tu cuenta para contactar al vendedor por WhatsApp. La compra se coordina con
            el negocio.
          </p>
          <form
            className="mt-5 space-y-3 pb-4"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                addToCart(product.id, qty);
                toast.success("Añadido al carrito");
                onClose();
              } catch {
                toast.error("No pudimos agregar el producto. Revisa tu carrito.");
              }
            }}
          >
            <div className="flex items-center justify-between rounded-xl bg-muted p-2">
              <span className="pl-2 text-sm font-bold">Cantidad</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Menos"
                  disabled={qty <= 1}
                  onClick={() => setQty((value) => Math.max(1, value - 1))}
                  className="press grid size-11 place-items-center rounded-full bg-card disabled:opacity-50"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-6 text-center font-black">{qty}</span>
                <button
                  type="button"
                  aria-label="Más"
                  disabled={qty >= Math.min(100, product.stock)}
                  onClick={() => setQty((value) => Math.min(100, product.stock, value + 1))}
                  className="press grid size-11 place-items-center rounded-full bg-card disabled:opacity-50"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={product.stock < 1}
              className="press min-h-13 w-full rounded-full bg-lime py-3.5 text-lg font-black text-lime-foreground disabled:opacity-50"
            >
              Agregar al carrito · S/ {(product.price * qty).toFixed(2)}
            </button>
            <Link
              to="/carrito"
              onClick={onClose}
              className="flex min-h-11 items-center justify-center font-bold"
            >
              Ver mi carrito
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Puedes preparar tu carrito sin cuenta. Te pediremos ingresar al continuar al pago.
            </p>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <li className="flex min-w-0 items-start gap-2 rounded-xl bg-muted p-2.5">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate font-bold">{value}</p>
      </div>
    </li>
  );
}

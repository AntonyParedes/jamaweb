import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3, MapPin, Minus, Plus, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { discountPercent, type Product } from "@/lib/products";
import { addReservation, useJama } from "@/lib/store";

export function ProductSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { profile } = useJama();
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (product) {
      setQty(1);
      setDone(false);
      setName(profile.name);
      setPhone(profile.phone);
    }
  }, [product, profile.name, profile.phone]);

  if (!product) return null;
  const pct = discountPercent(product.price, product.originalPrice);
  const phoneOk = /^9\d{8}$/.test(phone.replace(/\s/g, ""));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !name.trim() || !phoneOk) return;
    addReservation({ productId: product.id, name: name.trim(), phone: phone.replace(/\s/g, ""), qty });
    setDone(true);
    toast.success("¡Reserva enviada!");
  }

  return (
    <Drawer open={!!product} onOpenChange={(o) => !o && onClose()} repositionInputs>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg">
        <div className="pb-safe overflow-y-auto px-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-16 text-navy" />
              <DrawerTitle className="text-2xl font-black">¡Reservado!</DrawerTitle>
              <DrawerDescription>
                Recoge en {product.store}, {product.pickup}.
              </DrawerDescription>
              <button onClick={onClose} className="press mt-4 min-h-12 w-full rounded-full bg-lime font-black text-lime-foreground">
                Listo
              </button>
            </div>
          ) : (
            <>
              <div className="relative mt-2 overflow-hidden rounded-2xl">
                <img src={product.image} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-lime px-3 py-1 text-sm font-black text-lime-foreground">
                  -{pct}%
                </span>
              </div>
              <DrawerTitle className="mt-4 text-xl font-black leading-tight">{product.name}</DrawerTitle>
              <DrawerDescription className="sr-only">Detalle y reserva</DrawerDescription>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black">S/ {product.price}</span>
                <span className="text-muted-foreground line-through">S/ {product.originalPrice}</span>
                <span className="text-sm font-bold text-muted-foreground">Ahorras S/ {product.originalPrice - product.price}</span>
              </div>

              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Info icon={CalendarCheck} label="Elaborado" value={product.madeAt} />
                <Info icon={Clock3} label="Recojo" value={product.pickup} />
                <Info icon={Store} label="Local" value={product.store} />
                <Info icon={MapPin} label="Zona" value={product.zone} />
              </ul>
              {product.includes && (
                <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><b>Incluye:</b> {product.includes}</p>
              )}
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" /> Producto de hoy, foto real. Quedan {product.stock}.
              </p>

              <form onSubmit={submit} className="mt-5 space-y-3 pb-4">
                <div className="flex items-center justify-between rounded-xl bg-muted p-2">
                  <span className="pl-2 text-sm font-bold">Cantidad</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))} className="press grid size-11 place-items-center rounded-full bg-card">
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center font-black">{qty}</span>
                    <button type="button" aria-label="Más" onClick={() => setQty((q) => Math.min(product.stock, q + 1))} className="press grid size-11 place-items-center rounded-full bg-card">
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <input
                  required
                  autoComplete="name"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="WhatsApp (9 dígitos)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={phone.length > 0 && !phoneOk}
                  className="min-h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
                />
                <button
                  type="submit"
                  disabled={!name.trim() || !phoneOk}
                  className="press min-h-13 w-full rounded-full bg-lime py-3.5 text-lg font-black text-lime-foreground disabled:opacity-50"
                >
                  Reservar · S/ {product.price * qty}
                </button>
                <p className="text-center text-xs text-muted-foreground">Pagas al recoger o por Yape.</p>
              </form>
            </>
          )}
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
